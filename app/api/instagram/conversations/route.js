// app/api/instagram/conversations/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// GET - Lista conversas salvas no banco
export async function GET(request) {
 const supabase = getSupabaseAdmin();
 const { searchParams } = new URL(request.url);
 const organizacaoId = searchParams.get('organizacao_id');
 if (!organizacaoId) return NextResponse.json({ error: 'organizacao_id é obrigatório' }, { status: 400 });
 const { data, error } = await supabase
 .from('instagram_conversations')
 .select('*')
 .eq('organizacao_id', organizacaoId)
 .order('last_message_at', { ascending: false });
 if (error) return NextResponse.json({ error: error.message }, { status: 500 });
 return NextResponse.json(data || []);
}

// POST - Sincroniza conversas da API do Instagram para o banco
export async function POST(request) {
 const supabase = getSupabaseAdmin();
 try {
 const { organizacao_id } = await request.json();

 const { data: integracao } = await supabase
 .from('integracoes_meta')
 .select('instagram_business_account_id, page_access_token, page_id')
 .eq('organizacao_id', organizacao_id)
 .eq('is_active', true)
 .single();

 const igAccountId = integracao?.instagram_business_account_id || process.env.INSTAGRAM_ACCOUNT_ID;
 const pageId = integracao?.page_id;
 const accessToken = integracao?.page_access_token || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

 if (!igAccountId || !pageId || !accessToken) {
 return NextResponse.json({ error: 'Conta do Instagram não configurada.' }, { status: 404 });
 }

 // Buscar conversas levemente (apenas IDs e tempos de atualização)
 const url = `https://graph.facebook.com/v21.0/${pageId}/conversations?platform=instagram&fields=id,updated_time&limit=15&access_token=${accessToken}`;
 const response = await fetch(url);
 const metaData = await response.json();

 if (!response.ok || metaData.error) {
   const errMsg = metaData.error?.message || 'Falha ao buscar conversas.';
   console.error('[Instagram Conversations] Erro:', errMsg);
   return NextResponse.json({ error: errMsg }, { status: 500 });
 }

 const conversations = metaData.data || [];
 let synced = 0;

 for (const conv of conversations) {
   // Buscar participante individualmente para esta conversa
   let participant = null;
   try {
     const threadDetailsUrl = `https://graph.facebook.com/v21.0/${conv.id}?fields=participants&access_token=${accessToken}`;
     const threadRes = await fetch(threadDetailsUrl);
     if (threadRes.ok) {
       const threadData = await threadRes.json();
       participant = threadData.participants?.data?.find(p => p.id !== igAccountId);
     }
   } catch (errThread) {
     console.error(`[Instagram Conversations] Erro ao buscar participantes da thread ${conv.id}:`, errThread.message);
   }

   if (!participant) continue;

   const threadId = `${igAccountId}_${participant.id}`;
 
    // Buscar as mensagens desta thread específica com suporte a anexos
    let msgsList = [];
    try {
      const msgUrl = `https://graph.facebook.com/v21.0/${conv.id}/messages?fields=id,message,from,created_time,attachments{id,mime_type,name,size,file_url}&limit=25&access_token=${accessToken}`;
      const msgRes = await fetch(msgUrl);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        msgsList = msgData.data || [];
      } else {
        console.warn(`[Instagram Conversations] Falha ao obter mensagens da thread ${conv.id}`);
      }
    } catch (msgErr) {
      console.error(`[Instagram Conversations] Erro ao buscar mensagens da thread ${conv.id}:`, msgErr.message);
    }

    let snippet = null;
    let lastMessageAt = conv.updated_time ? new Date(conv.updated_time).toISOString() : new Date().toISOString();
    if (msgsList.length > 0) {
      const latestMsg = msgsList[0];
      const hasAttachments = latestMsg.attachments?.data && latestMsg.attachments.data.length > 0;
      if (hasAttachments) {
        const mime = latestMsg.attachments.data[0].mime_type || '';
        snippet = mime.startsWith('video') ? '🎥 Vídeo' : '📷 Foto';
      } else {
        snippet = latestMsg.message ? latestMsg.message.substring(0, 100) : null;
      }
      if (latestMsg.created_time) {
        lastMessageAt = new Date(latestMsg.created_time).toISOString();
      }
    }

    const { data: savedConv } = await supabase.from('instagram_conversations').upsert({
      organizacao_id,
      thread_id: threadId,
      instagram_account_id: igAccountId,
      instagram_conversation_id: conv.id,
      participant_id: participant.id,
      participant_name: participant.name || (participant.username ? `@${participant.username}` : `Usuário ${String(participant.id).slice(-6)}`),
      participant_username: participant.username || null,
      snippet: snippet,
      last_message_at: lastMessageAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'thread_id' }).select('id').single();

    // Sincronizar as mensagens diretamente para o banco
    if (savedConv && msgsList.length > 0) {
      // Reverter a lista para inserir em ordem cronológica (mais antigas primeiro)
      for (const msg of [...msgsList].reverse()) {
        const isOutbound = msg.from?.id === igAccountId || msg.from?.username === 'arqstudio57';
        const direction = isOutbound ? 'outbound' : 'inbound';
        const { data: existingMsg } = await supabase
          .from('instagram_messages')
          .select('id')
          .eq('message_id', msg.id)
          .maybeSingle();

        if (!existingMsg) {
          let msgContent = msg.message || '';
          let msgType = 'text';

          const hasAttachments = msg.attachments?.data && msg.attachments.data.length > 0;
          if (hasAttachments) {
            const att = msg.attachments.data[0];
            const url = att.file_url || att.url;
            if (url) {
              msgContent = url;
              const mime = att.mime_type || '';
              msgType = mime.startsWith('video') ? 'video' : 'image';
            }
          }

          await supabase.from('instagram_messages').insert({
            organizacao_id,
            conversation_id: savedConv.id,
            message_id: msg.id,
            from_id: msg.from?.id,
            from_name: msg.from?.name || msg.from?.username || 'Usuário',
            content: msgContent,
            message_type: msgType,
            direction,
            is_read: true,
            sent_at: msg.created_time ? new Date(msg.created_time).toISOString() : new Date().toISOString(),
          });
        }
      }
    }

    synced++;
 }

 return NextResponse.json({ ok: true, synced });

 } catch (error) {
 console.error('[Instagram Conversations] Erro:', error);
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
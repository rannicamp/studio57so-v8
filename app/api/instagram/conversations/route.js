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
 .select('instagram_business_account_id, page_access_token')
 .eq('organizacao_id', organizacao_id)
 .eq('is_active', true)
 .single();

 const igAccountId = integracao?.instagram_business_account_id || process.env.INSTAGRAM_ACCOUNT_ID;
 const accessToken = integracao?.page_access_token || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

 if (!igAccountId || !accessToken) {
 return NextResponse.json({ error: 'Conta do Instagram não configurada.' }, { status: 404 });
 }

 // Buscar conversas — incluindo o "id" da conversa no Instagram e ultimas mensagens
 const url = `https://graph.instagram.com/v21.0/${igAccountId}/conversations?platform=instagram&fields=id,participants,updated_time,messages.limit(25){id,message,from,created_time}&access_token=${accessToken}`;
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
 const participant = conv.participants?.data?.find(p => p.id !== igAccountId);
 if (!participant) continue;

 const threadId = `${igAccountId}_${participant.id}`;
 const msgsList = conv.messages?.data || [];
 let snippet = null;
 let lastMessageAt = conv.updated_time ? new Date(conv.updated_time).toISOString() : new Date().toISOString();
 if (msgsList.length > 0) {
 const latestMsg = msgsList[0];
 snippet = latestMsg.message ? latestMsg.message.substring(0, 100) : null;
 if (latestMsg.created_time) {
 lastMessageAt = new Date(latestMsg.created_time).toISOString();
 }
 }

 const { data: savedConv } = await supabase.from('instagram_conversations').upsert({
 organizacao_id,
 thread_id: threadId,
 instagram_account_id: igAccountId,
 instagram_conversation_id: conv.id, // ← Salvamos agora!
 participant_id: participant.id,
 participant_name: participant.name || `Usuário ${String(participant.id).slice(-6)}`,
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
 await supabase.from('instagram_messages').insert({
 organizacao_id,
 conversation_id: savedConv.id,
 message_id: msg.id,
 from_id: msg.from?.id,
 from_name: msg.from?.name || msg.from?.username || 'Usuário',
 content: msg.message || '',
 message_type: 'text',
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
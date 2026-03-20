// app/api/instagram/webhook/route.js
// Webhook para receber DMs do Instagram em tempo real via Meta Conversations API
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// --- ROTA GET (Verificação do Token no Painel da Meta) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('[Instagram Webhook] GET - Verificação recebida. Mode:', mode, 'Token:', token);

    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
        console.log('[Instagram Webhook] ✅ Verificação aprovada!');
        return new NextResponse(challenge, { status: 200 });
    }

    console.error('[Instagram Webhook] ❌ Falha na verificação. Token inválido.');
    return new NextResponse('Token Incorreto', { status: 403 });
}

// --- ROTA POST (Recebimento de Mensagens em Tempo Real) ---
export async function POST(request) {
    const supabase = getSupabaseAdmin();

    try {
        const body = await request.json();
        console.log('[Instagram Webhook] POST recebido:', JSON.stringify(body, null, 2));

        // A Meta envolve tudo em entry > changes
        const entry = body.entry?.[0];
        if (!entry) return NextResponse.json({ status: 'ignored_empty' });

        // Mensagens do Instagram chegam em "messaging"
        const messaging = entry.messaging?.[0];
        if (!messaging) {
            // Pode ser outro tipo de evento (comment, mention, etc.)
            console.log('[Instagram Webhook] Evento sem messaging, ignorando.');
            return NextResponse.json({ status: 'ok_no_message' });
        }

        const { sender, recipient, message, timestamp } = messaging;

        // Se não tem conteúdo de mensagem, ignora
        if (!message || !message.text) {
            console.log('[Instagram Webhook] Evento sem texto, ignorando. Tipo:', Object.keys(messaging));
            return NextResponse.json({ status: 'ok_no_text' });
        }

        const senderIgId = sender.id;       // ID do usuário que ENVIOU
        const recipientIgId = recipient.id; // ID da conta Instagram que RECEBEU (a nossa)

        // 1. Buscar a organização dona desta conta Instagram
        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('id, organizacao_id, page_access_token, instagram_business_account_id')
            .eq('instagram_business_account_id', recipientIgId)
            .eq('is_active', true)
            .single();

        if (!integracao) {
            console.error(`[Instagram Webhook] Nenhuma integração encontrada para a conta IG: ${recipientIgId}`);
            return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
        }

        const orgId = integracao.organizacao_id;
        const messageId = message.mid;

        // 2. Checar duplicidade
        const { data: existing } = await supabase
            .from('instagram_messages')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ status: 'ignored_duplicate' });
        }

        // 3. Buscar dados do remetente via Graph API
        let senderName = `Usuário ${senderIgId.slice(-6)}`;
        let senderUsername = null;
        let senderPicUrl = null;

        try {
            const profileRes = await fetch(
                `https://graph.facebook.com/v20.0/${senderIgId}?fields=name,username,profile_pic&access_token=${integracao.page_access_token}`
            );
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                senderName = profileData.name || senderName;
                senderUsername = profileData.username || null;
                senderPicUrl = profileData.profile_pic || null;
            }
        } catch (e) {
            console.warn('[Instagram Webhook] Não foi possível buscar perfil do remetente:', e.message);
        }

        // 4. Encontrar ou criar a conversa (thread)
        // Usamos uma thread_id composta: instaAccountId + senderIgId para garantir unicidade
        const threadId = `${recipientIgId}_${senderIgId}`;
        const sentAt = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

        const { data: conversation, error: convError } = await supabase
            .from('instagram_conversations')
            .upsert({
                organizacao_id: orgId,
                thread_id: threadId,
                instagram_account_id: recipientIgId,
                participant_id: senderIgId,
                participant_name: senderName,
                participant_username: senderUsername,
                participant_profile_pic: senderPicUrl,
                snippet: message.text?.substring(0, 100),
                last_message_at: sentAt,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'thread_id' })
            .select('id, unread_count')
            .single();

        if (convError || !conversation) {
            console.error('[Instagram Webhook] Erro ao criar/atualizar conversa:', convError);
            return NextResponse.json({ error: 'Erro ao salvar conversa' }, { status: 500 });
        }

        // Incrementar o contador de não lidas
        await supabase
            .from('instagram_conversations')
            .update({ unread_count: (conversation.unread_count || 0) + 1 })
            .eq('id', conversation.id);

        // 5. Inserir a mensagem
        const { error: msgError } = await supabase
            .from('instagram_messages')
            .insert({
                organizacao_id: orgId,
                conversation_id: conversation.id,
                message_id: messageId,
                from_id: senderIgId,
                from_name: senderName,
                content: message.text,
                message_type: 'text',
                direction: 'inbound',
                is_read: false,
                sent_at: sentAt,
            });

        if (msgError) {
            console.error('[Instagram Webhook] Erro ao salvar mensagem:', msgError);
        }

        console.log(`[Instagram Webhook] ✅ Mensagem de @${senderUsername || senderIgId} salva na Org ${orgId}`);
        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Instagram Webhook] ERRO FATAL:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

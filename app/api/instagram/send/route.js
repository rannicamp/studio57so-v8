// app/api/instagram/send/route.js
// Envia mensagem de resposta para usuário do Instagram via Instagram Login API
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { organizacao_id, conversation_id, recipient_id, text } = await request.json();

        if (!organizacao_id || !conversation_id || !recipient_id || !text?.trim()) {
            return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
        }

        // 1. Buscar token e ID da conta
        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('instagram_business_account_id, page_access_token')
            .eq('organizacao_id', organizacao_id)
            .eq('is_active', true)
            .single();

        const igAccountId = integracao?.instagram_business_account_id
            || process.env.INSTAGRAM_ACCOUNT_ID;
        const accessToken = integracao?.page_access_token
            || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

        if (!igAccountId || !accessToken) {
            return NextResponse.json({ error: 'Integração não configurada.' }, { status: 404 });
        }

        // 2. Enviar via Instagram API (graph.instagram.com)
        // POST /me/messages com recipient.id e message.text
        const sendUrl = `https://graph.instagram.com/v21.0/me/messages`;
        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipient_id },
                message: { text: text.trim() },
                access_token: accessToken,
            }),
        });

        const sendData = await sendResponse.json();

        if (!sendResponse.ok || sendData.error) {
            const errMsg = sendData.error?.message || 'Falha ao enviar mensagem.';
            console.error('[Instagram Send] Erro:', errMsg, sendData);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        // 3. Salvar a mensagem enviada no banco como "outbound"
        const now = new Date().toISOString();
        await supabase.from('instagram_messages').insert({
            organizacao_id,
            conversation_id,
            message_id: sendData.message_id || `out_${Date.now()}`,
            from_id: igAccountId,
            from_name: 'Studio 57',
            content: text.trim(),
            message_type: 'text',
            direction: 'outbound',
            is_read: true,
            sent_at: now,
        });

        // 4. Atualizar snippet da conversa
        await supabase.from('instagram_conversations')
            .update({ snippet: text.trim().substring(0, 100), last_message_at: now, updated_at: now })
            .eq('id', conversation_id);

        return NextResponse.json({ ok: true, message_id: sendData.message_id });

    } catch (error) {
        console.error('[Instagram Send] ERRO:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

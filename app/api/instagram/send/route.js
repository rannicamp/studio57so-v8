// app/api/instagram/send/route.js
// Envia uma mensagem de resposta para um usuário do Instagram
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

        // 1. Buscar a integração Meta com o page_access_token e instagram_business_account_id
        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('instagram_business_account_id, page_access_token')
            .eq('organizacao_id', organizacao_id)
            .eq('is_active', true)
            .single();

        if (!integracao || !integracao.instagram_business_account_id) {
            return NextResponse.json({ error: 'Integração Meta não configurada para esta organização.' }, { status: 404 });
        }

        const { instagram_business_account_id, page_access_token } = integracao;

        // 2. Enviar a mensagem pela Graph API do Instagram
        const sendUrl = `https://graph.facebook.com/v20.0/${instagram_business_account_id}/messages`;
        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipient_id },
                message: { text: text.trim() },
                access_token: page_access_token,
            }),
        });

        const sendData = await sendResponse.json();

        if (!sendResponse.ok || sendData.error) {
            const errMsg = sendData.error?.message || 'Falha ao enviar mensagem pelo Instagram.';
            console.error('[Instagram Send] Erro Meta:', errMsg, sendData);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        // 3. Salvar a mensagem enviada no banco como "outbound"
        const now = new Date().toISOString();
        await supabase.from('instagram_messages').insert({
            organizacao_id,
            conversation_id,
            message_id: sendData.message_id || `out_${Date.now()}`,
            from_id: instagram_business_account_id,
            from_name: 'Você',
            content: text.trim(),
            message_type: 'text',
            direction: 'outbound',
            is_read: true,
            sent_at: now,
        });

        // 4. Atualizar o snippet da conversa
        await supabase.from('instagram_conversations')
            .update({ snippet: text.trim().substring(0, 100), last_message_at: now, updated_at: now })
            .eq('id', conversation_id);

        return NextResponse.json({ ok: true, message_id: sendData.message_id });

    } catch (error) {
        console.error('[Instagram Send] ERRO:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

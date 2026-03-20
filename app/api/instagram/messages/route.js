// app/api/instagram/messages/route.js
// Busca mensagens de uma conversa: primeiro do banco, depois do Instagram se vazio
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id'); // ID interno do nosso banco

    if (!conversationId) {
        return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 });
    }

    // 1. Buscar a conversa no banco para pegar os dados necessários
    const { data: conv } = await supabase
        .from('instagram_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (!conv) {
        return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // 2. Buscar mensagens do banco local
    const { data: localMessages } = await supabase
        .from('instagram_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

    // 3. Se já tem mensagens no banco, retorna elas
    if (localMessages && localMessages.length > 0) {
        // Marca todas como lidas
        await supabase.from('instagram_messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .eq('is_read', false);
        await supabase.from('instagram_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);

        return NextResponse.json(localMessages);
    }

    // 4. Se banco vazio: buscar do Instagram via Graph API
    const igAccountId = conv.instagram_account_id || process.env.INSTAGRAM_ACCOUNT_ID;
    const instagramConvId = conv.instagram_conversation_id;

    // Buscar token da integração
    const { data: integracao } = await supabase
        .from('integracoes_meta')
        .select('page_access_token')
        .eq('organizacao_id', conv.organizacao_id)
        .eq('is_active', true)
        .single();

    const accessToken = integracao?.page_access_token || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    if (!instagramConvId || !accessToken) {
        console.warn('[Instagram Messages] Sem instagram_conversation_id ou token. Clique em Sincronizar primeiro.');
        return NextResponse.json([]);
    }

    try {
        // Buscar mensagens da thread via Instagram API
        const url = `https://graph.instagram.com/v21.0/${instagramConvId}/messages?fields=id,message,from,created_time&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('[Instagram Messages] Erro API:', data.error?.message);
            return NextResponse.json([]);
        }

        const msgs = data.data || [];
        const savedMessages = [];

        // Salvar cada mensagem no banco (ordem cronológica = reverso do que a API retorna)
        for (const msg of msgs.reverse()) {
            const isOutbound = msg.from?.id === igAccountId || msg.from?.username === 'arqstudio57';
            const direction = isOutbound ? 'outbound' : 'inbound';

            // Evitar duplicatas
            const { data: existing } = await supabase
                .from('instagram_messages')
                .select('id')
                .eq('message_id', msg.id)
                .maybeSingle();

            if (!existing) {
                const { data: inserted } = await supabase
                    .from('instagram_messages')
                    .insert({
                        organizacao_id: conv.organizacao_id,
                        conversation_id: conv.id,
                        message_id: msg.id,
                        from_id: msg.from?.id,
                        from_name: msg.from?.name || msg.from?.username || 'Usuário',
                        content: msg.message || '',
                        message_type: 'text',
                        direction,
                        is_read: true,
                        sent_at: msg.created_time ? new Date(msg.created_time).toISOString() : new Date().toISOString(),
                    })
                    .select()
                    .single();

                if (inserted) savedMessages.push(inserted);
            } else {
                // Já existe, buscar para retornar
                const { data: existingMsg } = await supabase
                    .from('instagram_messages')
                    .select('*')
                    .eq('message_id', msg.id)
                    .single();
                if (existingMsg) savedMessages.push(existingMsg);
            }
        }

        // Atualizar unread_count para 0
        await supabase.from('instagram_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);

        return NextResponse.json(savedMessages);

    } catch (err) {
        console.error('[Instagram Messages] Erro ao buscar da API:', err.message);
        return NextResponse.json([]);
    }
}
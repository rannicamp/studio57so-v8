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

        // Buscar conversas — incluindo o "id" da conversa no Instagram
        const url = `https://graph.instagram.com/v21.0/${igAccountId}/conversations?platform=instagram&fields=id,participants,snippet,unread_count,updated_time&access_token=${accessToken}`;
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

            await supabase.from('instagram_conversations').upsert({
                organizacao_id,
                thread_id: threadId,
                instagram_account_id: igAccountId,
                instagram_conversation_id: conv.id,  // ← Salvamos agora!
                participant_id: participant.id,
                participant_name: participant.name || `Usuário ${String(participant.id).slice(-6)}`,
                participant_username: participant.username || null,
                snippet: conv.snippet || null,
                unread_count: conv.unread_count || 0,
                last_message_at: conv.updated_time ? new Date(conv.updated_time).toISOString() : new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'thread_id' });

            synced++;
        }

        return NextResponse.json({ ok: true, synced });

    } catch (error) {
        console.error('[Instagram Conversations] Erro:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
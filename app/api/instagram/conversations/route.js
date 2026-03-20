// app/api/instagram/conversations/route.js
// Busca as conversas do Instagram salvas no banco (cache local)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// GET - Lista conversas do banco
export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const organizacaoId = searchParams.get('organizacao_id');

    if (!organizacaoId) {
        return NextResponse.json({ error: 'organizacao_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('instagram_conversations')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('last_message_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

// POST - Sincroniza conversas da API da Meta para o banco
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    try {
        const { organizacao_id } = await request.json();

        // 1. Buscar a integração Meta da organização
        const { data: integracao } = await supabase
            .from('integracoes_meta')
            .select('instagram_business_account_id, page_access_token')
            .eq('organizacao_id', organizacao_id)
            .eq('is_active', true)
            .single();

        if (!integracao || !integracao.instagram_business_account_id) {
            return NextResponse.json({ error: 'Conta do Instagram não configurada.' }, { status: 404 });
        }

        const { instagram_business_account_id, page_access_token } = integracao;

        // 2. Buscar conversas da API da Meta
        const url = `https://graph.facebook.com/v20.0/${instagram_business_account_id}/conversations?platform=instagram&fields=participants,snippet,unread_count,updated_time&access_token=${page_access_token}`;
        const response = await fetch(url);
        const metaData = await response.json();

        if (!response.ok || metaData.error) {
            const errMsg = metaData.error?.message || 'Falha ao buscar conversas na Meta.';
            console.error('[Instagram Conversations] Erro Meta:', errMsg);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }

        const conversations = metaData.data || [];
        let synced = 0;

        for (const conv of conversations) {
            // Participante que NÃO é a nossa conta
            const participant = conv.participants?.data?.find(p => p.id !== instagram_business_account_id);
            if (!participant) continue;

            const threadId = `${instagram_business_account_id}_${participant.id}`;

            await supabase.from('instagram_conversations').upsert({
                organizacao_id,
                thread_id: threadId,
                instagram_account_id: instagram_business_account_id,
                participant_id: participant.id,
                participant_name: participant.name || `Usuário ${participant.id.slice(-6)}`,
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
// app/api/instagram/messages/route.js
// Busca as mensagens de uma conversa do Instagram
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// GET - busca mensagens de uma conversa
export async function GET(request) {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
        return NextResponse.json({ error: 'conversation_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('instagram_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Marca todas como lidas
    await supabase
        .from('instagram_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false);

    await supabase
        .from('instagram_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

    return NextResponse.json(data || []);
}
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
 try {
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

  // 2. Zerar contadores de não lido
  await supabase.from('instagram_messages')
  .update({ is_read: true })
  .eq('conversation_id', conversationId)
  .eq('is_read', false);
  await supabase.from('instagram_conversations')
  .update({ unread_count: 0 })
  .eq('id', conversationId);

  // 3. Retornar mensagens locais (que já vieram por Webhook ou pelo Sync)
  const { data: localMessages } = await supabase
  .from('instagram_messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('sent_at', { ascending: true });

  return NextResponse.json(localMessages || []);
 } catch (err) {
  console.error("Edge crash prevent", err)
  return NextResponse.json({ error: 'Server Edge Error' }, { status: 500 });
 }
}
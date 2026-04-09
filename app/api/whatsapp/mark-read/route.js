import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { contact_id, organizacao_id, user_id, conversation_id } = body;

    if (!contact_id || !user_id || !conversation_id) {
      return NextResponse.json({ error: 'Parâmetros de Multi-Traffic ausentes (contact_id, user_id, conversation_id)' }, { status: 400 });
    }

    // 1. Marca as mensagens como lidas via RPC (JSONB Multi-Traffic)
    const { error: rpcError } = await supabaseAdmin.rpc('mark_whatsapp_messages_read_multi', {
      v_contact_id: contact_id,
      v_user_id: user_id
    });
    
    if (rpcError) console.error("Error marking messages", rpcError);

    // 2. ZERA o contador INDIVIDUAL de bolinha na tabela de conversas
    const { error } = await supabaseAdmin.rpc('reset_whatsapp_unreads', {
      v_conversation_id: conversation_id,
      v_user_id: user_id
    });

    if (error) {
      console.error('[Mark Read API] Erro ao atualizar conversa:', error);
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[Mark Read API] Erro fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
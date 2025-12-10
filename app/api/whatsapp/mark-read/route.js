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
        
        const { contact_id, organizacao_id } = body;

        if (!contact_id) {
            return NextResponse.json({ error: 'ID do contato é obrigatório' }, { status: 400 });
        }

        // 1. Marca as mensagens como lidas na tabela de mensagens (Histórico)
        await supabaseAdmin
            .from('whatsapp_messages')
            .update({ is_read: true })
            .match({ 
                contato_id: contact_id, 
                direction: 'inbound',
                is_read: false 
            });

        // 2. ZERA o contador na tabela de conversas (Para sumir a bolinha)
        // Isso resolve o problema de performance e sincronia
        const { error } = await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('contato_id', contact_id)
            .eq('organizacao_id', organizacaoId);

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
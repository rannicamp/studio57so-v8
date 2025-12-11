import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(request) {
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Config error" }, { status: 500 });
    
    // Usamos o admin para ignorar RLS e garantir limpeza completa
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

        // --- PASSO 1: Identificar os Broadcasts (Agendamentos) dessa lista ---
        const { data: broadcasts, error: fetchError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('id')
            .eq('lista_id', id);

        if (fetchError) throw new Error(`Erro ao buscar agendamentos: ${fetchError.message}`);

        const broadcastIds = broadcasts?.map(b => b.id) || [];

        // --- PASSO 2: Limpar dependências dos Broadcasts (se houver) ---
        if (broadcastIds.length > 0) {
            // A. Desvincular mensagens (Para não perder o histórico no chat, apenas removemos o link do broadcast)
            // Isso resolve o erro de Foreign Key na tabela whatsapp_messages
            const { error: unlinkError } = await supabaseAdmin
                .from('whatsapp_messages')
                .update({ broadcast_id: null })
                .in('broadcast_id', broadcastIds);

            if (unlinkError) throw new Error(`Erro ao desvincular mensagens: ${unlinkError.message}`);

            // B. Excluir os agendamentos/histórico
            const { error: deleteBroadcastsError } = await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .delete()
                .in('id', broadcastIds);

            if (deleteBroadcastsError) throw new Error(`Erro ao limpar histórico: ${deleteBroadcastsError.message}`);
        }

        // --- PASSO 3: Limpar Membros da Lista ---
        const { error: errorMembers } = await supabaseAdmin
            .from('whatsapp_list_members')
            .delete()
            .eq('lista_id', id);

        if (errorMembers) throw new Error(`Erro ao limpar membros: ${errorMembers.message}`);

        // --- PASSO 4: Finalmente, Excluir a Lista ---
        const { error: errorList } = await supabaseAdmin
            .from('whatsapp_broadcast_lists')
            .delete()
            .eq('id', id);

        if (errorList) throw errorList;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro fatal ao excluir lista:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
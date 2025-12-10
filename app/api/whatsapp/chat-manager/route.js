import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { action, conversationId, phoneNumber } = await request.json();

        // 1. RESOLVER ID (Garantia Extra)
        // Se veio o ID direto, usa ele. Se veio telefone, busca o ID.
        let targetId = conversationId;

        if (!targetId && phoneNumber) {
            const { data: conv } = await supabaseAdmin
                .from('whatsapp_conversations')
                .select('id')
                .eq('phone_number', phoneNumber)
                .single();
            
            if (conv) targetId = conv.id;
        }

        if (!targetId) return NextResponse.json({ error: 'ID ou Telefone inválido.' }, { status: 400 });

        // === AÇÃO: EXCLUIR (DELETE) ===
        if (action === 'delete') {
            console.log(`[Delete] Iniciando faxina para conversa ID: ${targetId}`);

            // PASSO 0: QUEBRAR O VÍNCULO (Solta a última mensagem)
            await supabaseAdmin
                .from('whatsapp_conversations')
                .update({ last_message_id: null })
                .eq('id', targetId);

            // PASSO 1: Buscar mensagens para apagar anexos
            const { data: messages } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('message_id')
                .eq('conversation_record_id', targetId);

            // PASSO 2: Apagar Anexos
            if (messages && messages.length > 0) {
                const messageIds = messages.map(m => m.message_id).filter(Boolean);
                if (messageIds.length > 0) {
                    await supabaseAdmin
                        .from('whatsapp_attachments')
                        .delete()
                        .in('message_id', messageIds);
                }
            }

            // PASSO 3: Apagar as Mensagens
            const { error: msgError } = await supabaseAdmin
                .from('whatsapp_messages')
                .delete()
                .eq('conversation_record_id', targetId);

            if (msgError) {
                return NextResponse.json({ error: `Erro ao apagar mensagens: ${msgError.message}` }, { status: 500 });
            }

            // PASSO 4: Apagar a Conversa
            const { error: convError } = await supabaseAdmin
                .from('whatsapp_conversations')
                .delete()
                .eq('id', targetId);

            if (convError) {
                return NextResponse.json({ error: `Erro ao apagar conversa: ${convError.message}` }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: "Conversa totalmente excluída!" });
        }

        // --- OUTRAS AÇÕES ---
        if (action === 'archive') {
            const { error } = await supabaseAdmin.from('whatsapp_conversations').update({ is_archived: true }).eq('id', targetId);
            if (error) throw error;
            return NextResponse.json({ success: true, message: "Arquivada" });
        }

        if (action === 'unarchive') {
            const { error } = await supabaseAdmin.from('whatsapp_conversations').update({ is_archived: false }).eq('id', targetId);
            if (error) throw error;
            return NextResponse.json({ success: true, message: "Desarquivada" });
        }

        // Ação nova para limpar contador (Visto Azul)
        if (action === 'mark_read') {
             await supabaseAdmin
                .from('whatsapp_messages')
                .update({ is_read: true })
                .eq('conversation_record_id', targetId)
                .eq('is_read', false);
             return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ error: `Erro Interno: ${error.message}` }, { status: 500 });
    }
}
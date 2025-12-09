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
        const { action, conversationId } = await request.json();

        if (!conversationId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

        // === AÇÃO: EXCLUIR (DELETE) ===
        if (action === 'delete') {
            console.log(`[Delete] Iniciando faxina para conversa ID: ${conversationId}`);

            // PASSO 0: QUEBRAR O VÍNCULO (O "Pulo do Gato" 🐈)
            // Removemos a referência da última mensagem para desbloquear a exclusão
            const { error: unlinkError } = await supabaseAdmin
                .from('whatsapp_conversations')
                .update({ last_message_id: null }) // <--- Isso solta a mensagem presa
                .eq('id', conversationId);

            if (unlinkError) {
                console.error("Erro ao desvincular last_message:", unlinkError);
                // Não paramos aqui, tentamos continuar, mas é bom logar.
            }

            // PASSO 1: Buscar mensagens para apagar anexos
            const { data: messages } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('message_id')
                .eq('conversation_record_id', conversationId);

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
            // Agora que o last_message_id é null, o banco vai deixar apagar!
            const { error: msgError } = await supabaseAdmin
                .from('whatsapp_messages')
                .delete()
                .eq('conversation_record_id', conversationId);

            if (msgError) {
                // Se ainda der erro, retornamos o detalhe técnico
                return NextResponse.json({ 
                    error: `Erro ao apagar mensagens: ${msgError.message}` 
                }, { status: 500 });
            }

            // PASSO 4: Apagar a Conversa
            const { error: convError } = await supabaseAdmin
                .from('whatsapp_conversations')
                .delete()
                .eq('id', conversationId);

            if (convError) {
                return NextResponse.json({ 
                    error: `Erro ao apagar conversa: ${convError.message}` 
                }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: "Conversa totalmente excluída!" });
        }

        // --- OUTRAS AÇÕES ---
        if (action === 'archive') {
            const { error } = await supabaseAdmin.from('whatsapp_conversations').update({ is_archived: true }).eq('id', conversationId);
            if (error) throw error;
            return NextResponse.json({ success: true, message: "Arquivada" });
        }

        if (action === 'unarchive') {
            const { error } = await supabaseAdmin.from('whatsapp_conversations').update({ is_archived: false }).eq('id', conversationId);
            if (error) throw error;
            return NextResponse.json({ success: true, message: "Desarquivada" });
        }

        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ error: `Erro Interno: ${error.message}` }, { status: 500 });
    }
}
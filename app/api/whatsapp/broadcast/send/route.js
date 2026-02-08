import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Config incompleta." }, { status: 500 });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();
        const { list_id, template_name, language, variables, full_text_base, components, scheduled_at } = body;

        const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').single();
        if (!config) return NextResponse.json({ error: 'Configuração não encontrada.' }, { status: 500 });

        // =====================================================================
        // 1. MODO AGENDAMENTO (Para o Futuro)
        // =====================================================================
        if (scheduled_at) {
            const { error: scheduleError } = await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .insert({
                    lista_id: list_id, 
                    template_name, 
                    language, 
                    variables, 
                    full_text_base, 
                    components, 
                    scheduled_at,
                    status: 'pending', 
                    organizacao_id: config.organizacao_id
                });
            if (scheduleError) throw scheduleError;
            return NextResponse.json({ message: 'Agendado!', scheduled: true, date: scheduled_at });
        }

        // =====================================================================
        // 2. MODO IMEDIATO (Enviar Agora e Registrar Estatísticas)
        // =====================================================================
        
        // A) Cria o registro no banco (como 'processing') para termos onde salvar as estatísticas
        const { data: newJob, error: createError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .insert({
                lista_id: list_id, 
                template_name, 
                language, 
                variables, 
                full_text_base, 
                components,
                scheduled_at: new Date().toISOString(), // Data de agora
                status: 'processing', // Já nasce processando
                organizacao_id: config.organizacao_id
            })
            .select()
            .single();

        if (createError) throw createError;

        // B) Busca os Membros
        const { data: members } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contatos(id, nome, telefones(telefone))')
            .eq('lista_id', list_id);
            
        const validTargets = members?.map(m => ({ 
            id: m.contatos?.id, 
            nome: m.contatos?.nome || 'Cliente', 
            telefone: m.contatos?.telefones?.[0]?.telefone 
        })).filter(t => t.telefone) || [];

        console.log(`[Broadcast] Iniciando envio manual (Job ${newJob.id}) para ${validTargets.length} contatos.`);

        // C) Chama o Processador (Passando o ID do Job para carimbar as mensagens!)
        const stats = await processBroadcast(supabaseAdmin, config, validTargets, {
            template_name, language, variables, full_text_base, components
        }, {
            jobId: newJob.id, // <--- O PULO DO GATO: Passamos o ID aqui!
            jobCreatedAt: newJob.created_at,
            batchSize: 50 // No envio manual, tentamos um lote maior (ou o total)
        });

        // D) Marca como concluído no banco
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'completed' })
            .eq('id', newJob.id);

        return NextResponse.json({ message: 'Enviado.', stats });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
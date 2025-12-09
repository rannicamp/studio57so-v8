import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor';

export const dynamic = 'force-dynamic'; // Garante que não faça cache e rode sempre

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    console.log("[Cron] Acordando para verificar agendamentos...");

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Cron] Erro: Configuração do servidor incompleta.");
        return NextResponse.json({ error: "Configuração interna inválida" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Buscar Agendamentos Pendentes e Vencidos
        // IMPORTANTE: Timezone UTC. O 'now' aqui é a hora zero (Z).
        const now = new Date().toISOString();
        
        console.log(`[Cron] Buscando jobs pendentes com data <= ${now}`);

        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', now) 
            .limit(1); // REDUZIDO PARA 1: Evita timeout em serverless (Netlify)

        if (jobsError) {
            console.error("[Cron] Erro ao buscar jobs no banco:", jobsError);
            return NextResponse.json({ error: jobsError.message }, { status: 500 });
        }

        if (!jobs || jobs.length === 0) {
            console.log("[Cron] Nenhum job pendente para agora.");
            return NextResponse.json({ message: 'Nada para processar.' });
        }

        const job = jobs[0];
        console.log(`[Cron] Job ${job.id} encontrado! Iniciando processamento...`);

        // 2. Travar o Job (Marcar como processing)
        const { error: updateError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing' })
            .eq('id', job.id);

        if (updateError) {
             console.error("[Cron] Erro ao travar job:", updateError);
             return NextResponse.json({ error: "Falha ao iniciar job" }, { status: 500 });
        }

        // 3. Executar o Disparo
        try {
            // Busca Configuração da Organização
            const { data: config } = await supabaseAdmin
                .from('configuracoes_whatsapp')
                .select('*')
                .eq('organizacao_id', job.organizacao_id)
                .single();

            if (!config) throw new Error(`Configuração WhatsApp não encontrada para org ${job.organizacao_id}`);
            
            // Busca Membros da Lista
            const { data: members, error: membersError } = await supabaseAdmin
                .from('whatsapp_list_members')
                .select('contatos(id, nome, telefones(telefone))')
                .eq('lista_id', job.lista_id);

            if (membersError) throw new Error(`Erro ao buscar membros: ${membersError.message}`);

            // Filtra e Prepara Alvos (Com proteção contra dados nulos)
            const validTargets = members?.map(m => {
                if (!m.contatos) return null;
                // Pega o primeiro telefone disponível
                const telefone = m.contatos.telefones && m.contatos.telefones.length > 0 
                    ? m.contatos.telefones[0].telefone 
                    : null;
                
                if (!telefone) return null;

                return {
                    id: m.contatos.id, 
                    nome: m.contatos.nome || 'Cliente', // Fallback de segurança
                    telefone: telefone
                };
            }).filter(t => t !== null) || [];

            console.log(`[Cron] Job ${job.id}: Enviando para ${validTargets.length} contatos.`);

            // CHAMA O PROCESSADOR (Aquele arquivo 'broadcastProcessor.js' que criamos)
            const stats = await processBroadcast(supabaseAdmin, config, validTargets, {
                template_name: job.template_name,
                language: job.language,
                variables: job.variables,
                full_text_base: job.full_text_base,
                components: job.components
            });

            console.log(`[Cron] Job ${job.id} finalizado com sucesso. Stats:`, stats);

            // 4. Finalizar com Sucesso
            await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .update({ status: 'completed' })
                .eq('id', job.id);
                
            return NextResponse.json({ processed: true, jobId: job.id, stats });

        } catch (processError) {
            console.error(`[Cron] Falha DURANTE o processamento do Job ${job.id}:`, processError);
            
            // Marca como falha para você saber que deu erro (e não ficar travado em processing)
            await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .update({ status: 'failed' }) 
                .eq('id', job.id);
                
            return NextResponse.json({ processed: false, error: processError.message }, { status: 500 });
        }

    } catch (e) {
        console.error("[Cron] Erro fatal inesperado:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
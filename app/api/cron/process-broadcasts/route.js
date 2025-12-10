import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    console.log("--- [CRON] Iniciando Rodada (Modo Lote) ---");

    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.json({ error: "Configuração inválida" }, { status: 500 });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    try {
        // 1. FAXINA (Mantida, mas só reseta se travar por > 5 min real)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'pending' }).eq('status', 'processing').lte('updated_at', fiveMinutesAgo);

        // 2. BUSCA TAREFA (Pode pegar 'pending' OU 'processing' se estiver na hora)
        // Isso permite continuar uma tarefa grande
        const { data: jobs } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .or('status.eq.pending,status.eq.processing') // Pega pendentes ou em andamento
            .lte('scheduled_at', now) 
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'Sem tarefas.' });

        const job = jobs[0];
        console.log(`[CRON] Trabalhando no Job ${job.id}.`);

        // 3. Travar e Atualizar Timestamp (Heartbeat)
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing', updated_at: now }) // Atualiza o relógio para não cair na faxina
            .eq('id', job.id);

        // 4. Preparar Dados
        const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', job.organizacao_id).single();
        const { data: members } = await supabaseAdmin.from('whatsapp_list_members').select('contatos(id, nome, telefones(telefone))').eq('lista_id', job.lista_id);

        const allTargets = members?.map(m => ({
            id: m.contatos?.id, nome: m.contatos?.nome || 'Cliente', telefone: m.contatos?.telefones?.[0]?.telefone
        })).filter(t => t.telefone) || [];

        // 5. PROCESSAR LOTE
        const BATCH_SIZE = 5; // Envia 5 por minuto (Seguro para Serverless)
        
        const stats = await processBroadcast(
            supabaseAdmin, 
            config, 
            allTargets, 
            {
                template_name: job.template_name,
                language: job.language,
                variables: job.variables,
                full_text_base: job.full_text_base,
                components: job.components
            },
            {
                jobId: job.id,
                jobCreatedAt: job.created_at, // Data base para verificar duplicidade
                batchSize: BATCH_SIZE
            }
        );

        // 6. VERIFICAR SE TERMINOU
        // Se o processador rodou menos que o limite, significa que acabou a lista de pendentes
        const totalProcessedNow = stats.processedInThisRun;
        
        // Verifica quantos faltam (Simples verificação: se processou 0, é porque todos já receberam)
        if (totalProcessedNow === 0) {
            console.log(`[CRON] Job ${job.id} finalizado (todos enviados).`);
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'completed' }).eq('id', job.id);
        } else {
            console.log(`[CRON] Job ${job.id} progresso: ${totalProcessedNow} enviados neste lote. Continua no próximo minuto.`);
            // Mantém como 'processing' e atualiza a hora
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ updated_at: new Date().toISOString() }).eq('id', job.id);
        }

        return NextResponse.json({ processed: true, jobId: job.id, stats, status: totalProcessedNow === 0 ? 'completed' : 'continuing' });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
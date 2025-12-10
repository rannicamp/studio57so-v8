import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processBroadcast } from '@/utils/broadcastProcessor';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    console.log("--- [CRON] Iniciando Rodada ---");

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração inválida" }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    try {
        // =====================================================================
        // 1. FAXINA CORRIGIDA: Usa 'updated_at' em vez de 'created_at'
        // =====================================================================
        // Só reseta se a tarefa foi ATUALIZADA (tocada pelo robô) há mais de 5 minutos
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { error: resetError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'pending' })
            .eq('status', 'processing')
            .lte('updated_at', fiveMinutesAgo); // <--- AQUI ESTAVA O ERRO (Antes era created_at)
            
        if (resetError) console.error("[CRON] Erro ao destravar jobs:", resetError);

        // =====================================================================
        // 2. BUSCAR TAREFA
        // =====================================================================
        const { data: jobs, error: jobsError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_at', now) 
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 });

        if (!jobs || jobs.length === 0) {
            return NextResponse.json({ message: 'Fila limpa.' });
        }

        const job = jobs[0];
        console.log(`[CRON] Processando Job ${job.id}.`);

        // 3. Travar Job (Isso vai atualizar o updated_at automaticamente pelo Trigger)
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing' })
            .eq('id', job.id);

        try {
            // Busca Dados
            const { data: config } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', job.organizacao_id).single();
            const { data: members, error: membersError } = await supabaseAdmin.from('whatsapp_list_members').select('contatos(id, nome, telefones(telefone))').eq('lista_id', job.lista_id);

            if (membersError) throw membersError;

            const validTargets = members?.map(m => {
                if (!m.contatos?.telefones?.[0]?.telefone) return null;
                return {
                    id: m.contatos.id, 
                    nome: m.contatos.nome || 'Cliente', 
                    telefone: m.contatos.telefones[0].telefone
                };
            }).filter(Boolean) || [];

            // Disparar
            const stats = await processBroadcast(supabaseAdmin, config, validTargets, {
                template_name: job.template_name,
                language: job.language,
                variables: job.variables,
                full_text_base: job.full_text_base,
                components: job.components
            });

            // Finalizar
            await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .update({ status: 'completed' })
                .eq('id', job.id);
            
            return NextResponse.json({ processed: true, jobId: job.id, stats });

        } catch (processError) {
            console.error(`[CRON] Falha Job ${job.id}:`, processError);
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'failed' }).eq('id', job.id);
            return NextResponse.json({ error: processError.message }, { status: 500 });
        }

    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
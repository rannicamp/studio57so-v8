import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Timeout de 60 segundos

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Função de Pausa (Sleep)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração de servidor incompleta" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    try {
        // 1. FAXINA DE TRAVAMENTOS (Se travou por mais de 5 min, libera)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'pending' })
            .eq('status', 'processing')
            .lte('updated_at', fiveMinutesAgo);

        // 2. BUSCAR TAREFA
        const { data: jobs, error: jobError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .in('status', ['pending', 'processing'])
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (jobError) throw new Error(jobError.message);
        if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'Nenhuma tarefa ativa.' });

        const job = jobs[0];

        // --- BUSCA CREDENCIAIS DA META (Correção do Erro de URL) ---
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .eq('organizacao_id', job.organizacao_id)
            .single();

        if (!config || !config.whatsapp_permanent_token || !config.whatsapp_phone_number_id) {
            console.error(`[CRON] Erro: Configuração do WhatsApp não encontrada para Org ${job.organizacao_id}`);
            // Marca como falha para não travar a fila
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'failed' }).eq('id', job.id);
            return NextResponse.json({ error: "Configuração WhatsApp ausente" });
        }

        // --- CONFIGURAÇÃO DO MODO SEGURO ---
        const BATCH_SIZE = 15; 
        const DELAY_BETWEEN_MSGS = 3000; // 3 segundos

        console.log(`[CRON] 🐢 Iniciando Modo Seguro Direto para Job ${job.id}.`);

        // 3. HEARTBEAT
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing', updated_at: now, started_at: job.started_at || now })
            .eq('id', job.id);

        // 4. IDENTIFICAR PENDENTES
        // Busca membros
        const { data: allMembers } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contato_id, contatos(id, nome, telefones(telefone))')
            .eq('lista_id', job.lista_id);

        // Busca já enviados
        const { data: alreadySent } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('contato_id')
            .eq('broadcast_id', job.id);

        const sentIds = new Set(alreadySent?.map(m => m.contato_id));

        // Filtra pendentes
        const pendingTargets = allMembers
            .filter(m => !sentIds.has(m.contato_id) && m.contatos?.telefones?.[0]?.telefone)
            .map(m => ({
                id: m.contatos.id,
                nome: m.contatos.nome || 'Cliente',
                telefone: m.contatos.telefones[0].telefone
            }));

        const totalReal = allMembers.length;
        const totalProcessadoAntes = sentIds.size;

        if (pendingTargets.length === 0) {
            await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .update({ 
                    status: 'completed', 
                    stopped_at: now, 
                    total_contacts: totalReal,
                    processed_count: totalReal 
                })
                .eq('id', job.id);
            return NextResponse.json({ message: 'Finalizado com sucesso!' });
        }

        // 5. SELECIONA O LOTE
        const batch = pendingTargets.slice(0, BATCH_SIZE);
        
        // 6. DISPARO SEQUENCIAL (Direto na Meta)
        let successCount = 0;
        let failedCount = 0;

        for (const target of batch) {
            // Verifica status (Pausa/Stop)
            const { data: checkStatus } = await supabaseAdmin
                .from('whatsapp_scheduled_broadcasts')
                .select('status')
                .eq('id', job.id)
                .single();

            if (checkStatus.status !== 'processing') {
                console.log("[CRON] Job interrompido pelo usuário.");
                break; 
            }

            try {
                // Prepara Variáveis
                const variables = (job.variables || []).map(v => v === '{{nome}}' ? target.nome.split(' ')[0] : v);
                
                // Monta Payload da Meta
                const payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: target.telefone,
                    type: 'template',
                    template: {
                        name: job.template_name,
                        language: { code: job.language || 'pt_BR' },
                        components: [
                            ...(job.components || []), // Mantém componentes visuais (imagem/video) se houver
                            // Adiciona corpo se houver variáveis
                            ...(variables.length > 0 ? [{
                                type: 'body',
                                parameters: variables.map(txt => ({ type: 'text', text: txt }))
                            }] : [])
                        ]
                    }
                };

                // ENVIA DIRETO PARA A META (Sem passar por /api/whatsapp/send)
                const response = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.whatsapp_permanent_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Erro na API da Meta');
                }

                // Salva Sucesso
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: config.whatsapp_phone_number_id,
                    receiver_id: target.telefone,
                    message_id: data.messages?.[0]?.id,
                    content: `Template: ${job.template_name}`,
                    status: 'sent',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id,
                    is_read: true,
                    created_at: new Date().toISOString()
                });

                successCount++;

            } catch (err) {
                console.error(`[CRON] Falha para ${target.nome}:`, err.message);
                // Salva Falha
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: config.whatsapp_phone_number_id,
                    receiver_id: target.telefone,
                    content: `Falha: ${err.message}`,
                    status: 'failed',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id,
                    created_at: new Date().toISOString()
                });
                failedCount++;
            }

            if (target !== batch[batch.length - 1]) {
                await sleep(DELAY_BETWEEN_MSGS);
            }
        }

        // 7. ATUALIZA CONTADORES
        const { data: currentJobData } = await supabaseAdmin.from('whatsapp_scheduled_broadcasts').select('success_count, failed_count').eq('id', job.id).single();
        
        const newSuccess = (currentJobData?.success_count || 0) + successCount;
        const newFailed = (currentJobData?.failed_count || 0) + failedCount;
        const newProcessed = totalProcessadoAntes + successCount + failedCount;

        const isFinished = (pendingTargets.length <= batch.length) && (successCount + failedCount === batch.length);

        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ 
                processed_count: newProcessed,
                success_count: newSuccess,
                failed_count: newFailed,
                total_contacts: totalReal,
                updated_at: new Date().toISOString(),
                status: isFinished ? 'completed' : 'processing',
                stopped_at: isFinished ? new Date().toISOString() : null
            })
            .eq('id', job.id);

        return NextResponse.json({ 
            message: 'Lote Direto processado', 
            stats: { sent: successCount, failed: failedCount },
            status: isFinished ? 'completed' : 'processing'
        });

    } catch (e) {
        console.error("[CRON] Erro Fatal:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
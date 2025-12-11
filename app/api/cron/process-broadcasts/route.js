import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Timeout de 60 segundos

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Função de Pausa
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Função para limpar telefone (mantém apenas números)
const sanitizePhone = (phone) => {
    if (!phone) return null;
    return phone.replace(/\D/g, ''); // Remove tudo que não é número
};

export async function GET(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração incompleta" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    try {
        // 1. FAXINA DE JOBS TRAVADOS (Reset se travado há > 5min)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'pending' })
            .eq('status', 'processing')
            .lte('updated_at', fiveMinutesAgo);

        // 2. BUSCAR TAREFA
        const { data: jobs } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .in('status', ['pending', 'processing'])
            .lte('scheduled_at', now)
            .order('scheduled_at', { ascending: true })
            .limit(1);

        if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'Sem tarefas.' });

        const job = jobs[0];

        // --- MODO SEGURO ---
        // 5 msgs por lote com pausas curtas garante entrega sem timeout
        const BATCH_SIZE = 10; 
        const DELAY_MS = 2000; 

        // 3. HEARTBEAT (Trava o job)
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing', updated_at: now, started_at: job.started_at || now })
            .eq('id', job.id);

        // 4. BUSCAR DADOS
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .eq('organizacao_id', job.organizacao_id)
            .single();

        if (!config?.whatsapp_permanent_token) {
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts').update({ status: 'failed' }).eq('id', job.id);
            return NextResponse.json({ error: "Sem configuração de WhatsApp" });
        }

        // Busca pendentes (Lógica otimizada)
        // Pega membros da lista
        const { data: members } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contato_id, contatos(id, nome, telefones(telefone))')
            .eq('lista_id', job.lista_id);

        // Pega já enviados
        const { data: sent } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('contato_id')
            .eq('broadcast_id', job.id);
        
        const sentSet = new Set(sent?.map(s => s.contato_id));

        // Filtra
        const targets = members
            ?.filter(m => !sentSet.has(m.contato_id) && m.contatos?.telefones?.[0]?.telefone)
            .map(m => ({
                id: m.contatos.id,
                nome: m.contatos.nome || 'Cliente',
                phone: sanitizePhone(m.contatos.telefones[0].telefone)
            })) || [];

        const totalReal = members.length;
        const totalProcessedBefore = sentSet.size;

        if (targets.length === 0) {
            await supabaseAdmin.from('whatsapp_scheduled_broadcasts')
                .update({ status: 'completed', stopped_at: now, total_contacts: totalReal, processed_count: totalReal })
                .eq('id', job.id);
            return NextResponse.json({ message: 'Finalizado' });
        }

        // 5. PROCESSAR LOTE
        const batch = targets.slice(0, BATCH_SIZE);
        let success = 0;
        let failed = 0;

        for (const target of batch) {
            // Checa pausa a cada envio
            const { data: check } = await supabaseAdmin.from('whatsapp_scheduled_broadcasts').select('status').eq('id', job.id).single();
            if (check.status !== 'processing') break;

            try {
                // Variáveis
                const vars = (job.variables || []).map(v => v === '{{nome}}' ? target.nome.split(' ')[0] : v);
                
                // Envio Direto Meta
                const res = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.whatsapp_permanent_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: target.phone,
                        type: 'template',
                        template: {
                            name: job.template_name,
                            language: { code: job.language || 'pt_BR' },
                            components: vars.length ? [{ type: 'body', parameters: vars.map(t => ({ type: 'text', text: t })) }] : []
                        }
                    })
                });

                const json = await res.json();

                if (!res.ok) throw new Error(json.error?.message || 'Erro Meta');

                // Sucesso
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: config.whatsapp_phone_number_id,
                    receiver_id: target.phone,
                    message_id: json.messages?.[0]?.id,
                    content: `Template: ${job.template_name}`,
                    status: 'sent',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id,
                    is_read: true,
                    created_at: new Date().toISOString()
                });
                success++;

            } catch (err) {
                console.error(`Erro envio ${target.nome}:`, err.message);
                // Falha
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: 'SYSTEM',
                    receiver_id: target.phone,
                    content: `Falha: ${err.message}`,
                    status: 'failed',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id,
                    created_at: new Date().toISOString()
                });
                failed++;
            }
            await sleep(DELAY_MS);
        }

        // 6. ATUALIZAR CONTADORES
        const { data: current } = await supabaseAdmin.from('whatsapp_scheduled_broadcasts').select('success_count, failed_count').eq('id', job.id).single();
        
        const newSuccess = (current?.success_count || 0) + success;
        const newFailed = (current?.failed_count || 0) + failed;
        const newTotalProcessed = totalProcessedBefore + success + failed;

        const isDone = (targets.length <= batch.length) && (success + failed === batch.length);

        await supabaseAdmin.from('whatsapp_scheduled_broadcasts')
            .update({
                processed_count: newTotalProcessed,
                success_count: newSuccess,
                failed_count: newFailed,
                total_contacts: totalReal,
                status: isDone ? 'completed' : 'processing',
                stopped_at: isDone ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq('id', job.id);

        return NextResponse.json({ success: true, processed: success + failed });

    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
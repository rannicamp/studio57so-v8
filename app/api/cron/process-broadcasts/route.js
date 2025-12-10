import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppTemplate } from '@/utils/whatsapp'; // Importamos direto o carteiro

export const dynamic = 'force-dynamic'; // Garante que não faça cache
export const maxDuration = 60; // Define timeout para 60s (Vercel Pro)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração de servidor incompleta" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    try {
        // 1. FAXINA DE TRAVAMENTOS (Reseta jobs 'processing' que pararam há mais de 2 min)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'pending' }) // Devolve para fila
            .eq('status', 'processing')
            .lte('updated_at', twoMinutesAgo);

        // 2. BUSCAR TAREFA (PRIORITÁRIA)
        // Busca jobs Pendentes ou Processando, que NÃO estejam Pausados ou Parados
        const { data: jobs, error: jobError } = await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .select('*')
            .in('status', ['pending', 'processing']) // Só pega o que deve rodar
            .lte('scheduled_at', now) // Que já passou da hora
            .order('scheduled_at', { ascending: true }) // Mais antigos primeiro
            .limit(1);

        if (jobError) throw new Error(jobError.message);
        if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'Nenhuma tarefa ativa no momento.' });

        const job = jobs[0];
        const BATCH_SIZE = 50; // TURBO: 50 envios por execução (Seguro e rápido)

        console.log(`[CRON] 🚀 Iniciando Turbo Lote para Job ${job.id} (${job.template_name})`);

        // 3. HEARTBEAT (Avisa que está vivo)
        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ status: 'processing', updated_at: now, started_at: job.started_at || now })
            .eq('id', job.id);

        // 4. IDENTIFICAR QUEM FALTA (A Lógica de Resumo)
        // Busca TODOS os membros da lista
        const { data: allMembers } = await supabaseAdmin
            .from('whatsapp_list_members')
            .select('contato_id, contatos(id, nome, telefones(telefone))')
            .eq('lista_id', job.lista_id);

        // Busca QUEM JÁ RECEBEU desta transmissão
        const { data: alreadySent } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('contato_id')
            .eq('broadcast_id', job.id);

        const sentIds = new Set(alreadySent?.map(m => m.contato_id));

        // Filtra apenas os pendentes que têm telefone válido
        const pendingTargets = allMembers
            .filter(m => !sentIds.has(m.contato_id) && m.contatos?.telefones?.[0]?.telefone)
            .map(m => ({
                id: m.contatos.id,
                nome: m.contatos.nome || 'Cliente',
                telefone: m.contatos.telefones[0].telefone
            }));

        // ATUALIZA O TOTAL REAL NO BANCO (Para a barra de progresso ficar certa)
        const totalReal = allMembers.length;
        const totalProcessadoAntes = sentIds.size;
        
        // Se acabou, finaliza agora
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
            return NextResponse.json({ message: 'Job finalizado com sucesso!' });
        }

        // 5. SELECIONA O LOTE DA VEZ
        const batch = pendingTargets.slice(0, BATCH_SIZE);
        console.log(`[CRON] 🎯 Processando lote de ${batch.length} contatos. Restam: ${pendingTargets.length - batch.length}`);

        // 6. DISPARO EM PARALELO (O Segredo da Velocidade)
        let successCount = 0;
        let failedCount = 0;

        const promises = batch.map(async (target) => {
            try {
                // Prepara variáveis (substitui {{1}} pelo nome, se houver)
                const variables = (job.variables || []).map(v => v === '{{nome}}' ? target.nome.split(' ')[0] : v);
                
                // Envia (Usa a função que já existe no seu sistema)
                // Nota: Assumimos que sendWhatsAppTemplate retorna { success: true/false } ou lança erro
                // Se sua função interna for diferente, o catch abaixo pega o erro.
                const result = await sendWhatsAppTemplate(
                    target.telefone, 
                    job.template_name, 
                    job.language, 
                    // Monta componente body com variáveis
                    variables.length > 0 ? [{ type: 'body', parameters: variables.map(txt => ({ type: 'text', text: txt })) }] : []
                );

                if (result && result.success === false) throw new Error(result.error || 'Erro desconhecido');

                // Salva o registro da mensagem (Para não enviar de novo)
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: 'BROADCAST',
                    receiver_id: target.telefone,
                    content: `Template: ${job.template_name}`,
                    status: 'sent',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id,
                    is_read: true // Mensagem enviada por nós já nasce lida
                });

                successCount++;
            } catch (err) {
                console.error(`[CRON] Erro ao enviar para ${target.nome}:`, err.message);
                
                // Mesmo com erro, registramos na tabela de mensagens com status 'failed'
                // para não ficar tentando eternamente o mesmo número quebrado
                await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: target.id,
                    broadcast_id: job.id,
                    sender_id: 'BROADCAST',
                    receiver_id: target.telefone,
                    content: `Falha: ${err.message}`,
                    status: 'failed',
                    direction: 'outbound',
                    organizacao_id: job.organizacao_id
                });
                
                failedCount++;
            }
        });

        // Aguarda todos do lote terminarem (Paralelismo real)
        await Promise.all(promises);

        // 7. ATUALIZA CONTADORES NO BANCO
        // Somamos o que acabamos de fazer com o que já tinha no banco
        // Nota: Para precisão absoluta em concorrência alta usaria RPC, mas aqui é seguro pois só tem 1 cron por vez.
        const currentJobData = await supabaseAdmin.from('whatsapp_scheduled_broadcasts').select('success_count, failed_count').eq('id', job.id).single();
        
        const newSuccess = (currentJobData.data?.success_count || 0) + successCount;
        const newFailed = (currentJobData.data?.failed_count || 0) + failedCount;
        const newProcessed = totalProcessadoAntes + batch.length;

        // Verifica se completou TUDO nesse lote
        const isFinished = (pendingTargets.length - batch.length) === 0;

        await supabaseAdmin
            .from('whatsapp_scheduled_broadcasts')
            .update({ 
                processed_count: newProcessed,
                success_count: newSuccess,
                failed_count: newFailed,
                total_contacts: totalReal, // Atualiza sempre para garantir consistência
                updated_at: new Date().toISOString(),
                status: isFinished ? 'completed' : 'processing',
                stopped_at: isFinished ? new Date().toISOString() : null
            })
            .eq('id', job.id);

        return NextResponse.json({ 
            message: 'Lote processado', 
            stats: { sent: successCount, failed: failedCount, remaining: pendingTargets.length - batch.length },
            status: isFinished ? 'completed' : 'processing'
        });

    } catch (e) {
        console.error("[CRON] Erro Fatal:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
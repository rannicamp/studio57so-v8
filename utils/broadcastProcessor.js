import { createClient } from '@supabase/supabase-js';

// Delay para segurança (entre envios)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processBroadcast(supabaseAdmin, config, targetContacts, templateData, jobInfo) {
    const { template_name, language, variables, full_text_base, components: extraComponents } = templateData;
    // Pega o ID do Job (Broadcast)
    const { jobId, jobCreatedAt, batchSize = 5 } = jobInfo || {}; 
    
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    console.log(`[Processor] Processando lote para Job ${jobId}...`);

    for (const target of targetContacts) {
        if (processedCount >= batchSize) break;

        try {
            // Verificação de segurança (Idempotência)
            const { data: existingMsg } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id')
                .eq('contato_id', target.id)
                .eq('direction', 'outbound')
                .gte('created_at', jobCreatedAt) 
                .limit(1);

            if (existingMsg && existingMsg.length > 0) {
                continue; 
            }

            processedCount++;

            // Humanização
            const firstName = target.nome ? target.nome.split(' ')[0] : 'Cliente';
            const personalizedVariables = [...(variables || [])];
            if (personalizedVariables.length > 0) personalizedVariables[0] = firstName;

            // Monta Componentes
            const messageComponents = [];
            if (extraComponents && Array.isArray(extraComponents)) {
                const headerComp = extraComponents.find(c => c.type === 'header');
                if (headerComp) messageComponents.push(headerComp);
            }
            if (personalizedVariables.length > 0) {
                messageComponents.push({
                    type: 'body',
                    parameters: personalizedVariables.map(v => ({ type: 'text', text: v }))
                });
            }

            // Texto Histórico
            let personalizedText = full_text_base || `Template: ${template_name}`;
            personalizedVariables.forEach((val, i) => {
                personalizedText = personalizedText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
            });

            // Payload API
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: target.telefone,
                type: 'template',
                template: {
                    name: template_name,
                    language: { code: language || 'pt_BR' },
                    components: messageComponents
                }
            };

            const response = await fetch(`https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.whatsapp_permanent_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resData = await response.json();

            if (!response.ok) {
                console.error(`[Processor] Falha para ${target.nome}:`, resData);
                failCount++;
            } else {
                successCount++;
                const newMessageId = resData.messages?.[0]?.id;
                if (newMessageId) {
                    await supabaseAdmin.from('whatsapp_messages').insert({
                        contato_id: target.id,
                        message_id: newMessageId,
                        sender_id: config.whatsapp_phone_number_id,
                        receiver_id: target.telefone,
                        content: personalizedText,
                        sent_at: new Date().toISOString(),
                        direction: 'outbound',
                        status: 'sent',
                        raw_payload: JSON.stringify(payload),
                        organizacao_id: config.organizacao_id,
                        broadcast_id: jobId // <--- AQUI ESTÁ O CARIMBO NOVO!
                    });
                }
            }

            const delay = 4000; 
            await sleep(delay);

        } catch (error) {
            console.error(`[Processor] Erro no loop:`, error);
            failCount++;
        }
    }

    return { 
        processedInThisRun: processedCount, 
        success: successCount, 
        failed: failCount,
        skipped: skippedCount
    };
}
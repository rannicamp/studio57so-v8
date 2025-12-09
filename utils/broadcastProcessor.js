import { createClient } from '@supabase/supabase-js';

// Delay para segurança
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processBroadcast(supabaseAdmin, config, targetContacts, templateData) {
    const { template_name, language, variables, full_text_base, components: extraComponents } = templateData;
    
    let successCount = 0;
    let failCount = 0;
    const results = [];

    console.log(`[Processor] Iniciando envio para ${targetContacts.length} contatos.`);

    for (const target of targetContacts) {
        try {
            // 1. HUMANIZAÇÃO: Extrair Primeiro Nome
            const firstName = target.nome.split(' ')[0] || target.nome;
            
            // 2. Personalizar Variáveis
            const personalizedVariables = [...(variables || [])];
            if (personalizedVariables.length > 0) {
                personalizedVariables[0] = firstName; // Substitui {{1}}
            }

            // 3. Montar Componentes (Body + Header se tiver)
            const messageComponents = [];
            
            // Adiciona Header/Mídia se veio do modal
            if (extraComponents && extraComponents.length > 0) {
                // Filtra apenas componentes de HEADER para garantir
                const headerComp = extraComponents.find(c => c.type === 'header');
                if (headerComp) messageComponents.push(headerComp);
            }

            // Adiciona Body com variáveis personalizadas
            if (personalizedVariables.length > 0) {
                messageComponents.push({
                    type: 'body',
                    parameters: personalizedVariables.map(v => ({ type: 'text', text: v }))
                });
            }

            // 4. Montar Texto para Histórico
            let personalizedText = full_text_base || `Template: ${template_name}`;
            personalizedVariables.forEach((val, i) => {
                personalizedText = personalizedText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
            });

            // 5. Payload Meta
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

            // 6. Envio
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
                results.push({ contact: target.nome, status: 'error', error: resData });
            } else {
                successCount++;
                results.push({ contact: target.nome, status: 'success' });

                // Salva no Histórico Individual
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
                        organizacao_id: config.organizacao_id
                    });
                }
            }

            // 7. Delay de Segurança (2 a 4 segundos)
            const delay = Math.floor(Math.random() * 2000) + 2000;
            await sleep(delay);

        } catch (error) {
            console.error(`[Processor] Erro interno:`, error);
            failCount++;
        }
    }

    return { total: targetContacts.length, success: successCount, failed: failCount };
}
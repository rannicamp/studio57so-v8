import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- NOVA FUNÇÃO PARA CHAMAR O "CARTEIRO CENTRAL" ---
// Esta função substitui a antiga 'sendPushNotificationsToOrg'.
// Sua única responsabilidade é chamar nossa API dedicada de notificações.
async function notifyOrg(organizacao_id, title, message) {
    // Garante que temos uma URL base para fazer a chamada interna da API.
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const absoluteUrl = new URL('/api/notifications/send', baseUrl);

    try {
        // Dispara a chamada para a nossa rota central de notificações.
        // O 'await' aqui não é estritamente necessário se não precisarmos esperar a resposta.
        // Podemos deixar a notificação ser enviada em segundo plano.
        fetch(absoluteUrl.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organizacao_id: organizacao_id,
                title: title, // O título que será usado no payload
                body: message // O corpo da mensagem que será usado no payload
            }),
        });
        console.log('[Webhook] Chamada para a API central de notificação foi enviada.');
    } catch (error) {
        console.error('[Webhook] Erro ao tentar chamar a API de notificação:', error);
    }
}


// --- INICIALIZAÇÃO DOS SERVIÇOS ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// --- FUNÇÕES DE COMUNICAÇÃO COM WHATSAPP (SEU CÓDIGO ORIGINAL, SEM ALTERAÇÕES) ---
async function sendTemplateMessage(supabase, config, to, contato, templateName, language) {
    if (!templateName) {
        console.error("[Automação Webhook] Nome do template não fornecido.");
        return;
    }
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const components = [{
        type: 'body',
        parameters: [{ type: 'text', text: contato.nome || 'Prezado(a)' }]
    }];
    const payload = {
        messaging_product: "whatsapp", to: to, type: "template",
        template: { name: templateName, language: { code: language }, components }
    };

    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
        const responseData = await response.json();
        if (!response.ok) {
            console.error(`[Automação Webhook] ERRO ao enviar template ${templateName}:`, responseData);
            return;
        }
        const messageId = responseData.messages?.[0]?.id;
        if (messageId) {
            await supabase.from('whatsapp_messages').insert({
                contato_id: contato.id, message_id: messageId, sender_id: config.whatsapp_phone_number_id, receiver_id: to,
                content: `(Automação) Template: ${templateName}`, direction: 'outbound', status: 'sent', raw_payload: payload,
                sent_at: new Date().toISOString(), organizacao_id: config.organizacao_id
            });
            console.log(`[Automação Webhook] Template ${templateName} enviado para o novo contato ${contato.id}.`);
        }
    } catch (error) {
        console.error(`[Automação Webhook] ERRO de rede ao enviar o template ${templateName}:`, error);
    }
}


// --- FUNÇÕES AUXILIARES (SEU CÓDIGO ORIGINAL, SEM ALTERAÇÕES) ---
function getTextContent(message) {
    if (!message || !message.type) { return null; }
    switch (message.type) {
        case 'text': return message.text?.body || null;
        case 'interactive':
            if (message.interactive?.button_reply) return message.interactive.button_reply.title;
            if (message.interactive?.list_reply) return message.interactive.list_reply.title;
            return null;
        default: return null;
    }
}

function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');
    let numbersToSearch = new Set();
    numbersToSearch.add(digitsOnly);
    const brazilDDI = '55';
    const minBrazilLength = 10;
    const maxBrazilLength = 11;
    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === minBrazilLength || digitsOnly.length === maxBrazilLength) {
            numbersToSearch.add(brazilDDI + digitsOnly);
        }
    }
    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        if (remainingDigits.startsWith('9') && remainingDigits.length === 9) {
            numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
        }
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        numbersToSearch.add(ddiDdd + '9' + remainingDigits);
    }
    return Array.from(numbersToSearch);
}

// --- ROTAS (WEBHOOK) ---
export async function GET(request) {
    const searchParams = new URL(request.url).searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token'); // Corrigido de search_params
    const challenge = searchParams.get('hub.challenge');
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        // --- TODA A SUA LÓGICA DE NEGÓCIO ESTÁ INTACTA ---
        const body = await request.json();
        const { data: whatsappConfig } = await supabaseAdmin.from('configuracoes_whatsapp').select('*, organizacao_id').limit(1).single();
        if (!whatsappConfig || !whatsappConfig.organizacao_id) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp ou organizacao_id não encontradas.");
            return NextResponse.json({ status: 'error', message: 'Configuração do WhatsApp ou organizacao_id ausente.' }, { status: 500 });
        }
        const statusEntry = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
        if (statusEntry) {
            return NextResponse.json({ status: 'ok' });
        }
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contatoId = null;
            let currentContato = null;

            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            
            if (matchingPhones?.length > 0) {
                contatoId = matchingPhones[0].contato_id;
            }
            
            if (!contatoId) {
                const { data: newContact, error: contactError } = await supabaseAdmin.from('contatos').insert({ 
                    nome: `Lead (${contactPhoneNumber})`,
                    tipo_contato: 'Lead',
                    is_awaiting_name_response: false,
                    organizacao_id: whatsappConfig.organizacao_id 
                }).select('id, nome').single();

                if (contactError) {
                    console.error("ERRO ao criar novo contato:", contactError);
                    return NextResponse.json({ status: 'error', message: 'Falha ao criar contato.' }, { status: 500 });
                }
                contatoId = newContact.id;
                currentContato = newContact;
                
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId,
                    telefone: contactPhoneNumber,
                    tipo: 'celular',
                    organizacao_id: whatsappConfig.organizacao_id
                });
                
                const { data: funnelData } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', whatsappConfig.organizacao_id).order('created_at').limit(1).single();
                if (funnelData) {
                    const { data: columnData } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funnelData.id).order('ordem').limit(1).single();
                    if (columnData) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: columnData.id, organizacao_id: whatsappConfig.organizacao_id });
                        
                        const { data: automacoes } = await supabaseAdmin.from('automacoes').select('*').eq('organizacao_id', whatsappConfig.organizacao_id).eq('ativo', true).eq('gatilho_tipo', 'CRIAR_CARD').eq('gatilho_config->>coluna_id', columnData.id);
                        if (automacoes && automacoes.length > 0) {
                            for (const regra of automacoes) {
                                if (regra.acao_tipo === 'ENVIAR_WHATSAPP') {
                                    const { template_nome, template_idioma } = regra.acao_config;
                                    await sendTemplateMessage(supabaseAdmin, whatsappConfig, contactPhoneNumber, newContact, template_nome, template_idioma);
                                }
                            }
                        }
                    }
                }
            } else {
                const { data: existingContato } = await supabaseAdmin.from('contatos').select('id, nome, is_awaiting_name_response').eq('id', contatoId).single();
                currentContato = existingContato;
            }
            
            if (currentContato?.is_awaiting_name_response && messageContent && messageContent.length > 2 && !/^(oi|olá|obrigado)$/i.test(messageContent.toLowerCase())) {
                await supabaseAdmin.from('contatos').update({ nome: messageContent, is_awaiting_name_response: false }).eq('id', contatoId);
                currentContato.nome = messageContent;
            }
            
            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId, message_id: messageEntry.id, sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id, content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: messageEntry,
                organizacao_id: whatsappConfig.organizacao_id
            });
            
            // ########## PONTO DA ALTERAÇÃO ##########
            if (messageContent) { 
                const contatoNome = currentContato?.nome || `Lead (${contactPhoneNumber})`;
                // Chamando a nossa nova função que usa a API central
                await notifyOrg(
                    whatsappConfig.organizacao_id,
                    `Nova mensagem de ${contatoNome}`,
                    messageContent
                );
            }
            // ######################################

            await supabaseAdmin.from('whatsapp_conversations').upsert({ phone_number: contactPhoneNumber, updated_at: new Date().toISOString() }, { onConflict: ['phone_number'] });
        }
        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error("ERRO INESPERADO no webhook (catch final):", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
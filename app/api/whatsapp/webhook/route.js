import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- Funções Auxiliares (Sua lógica original, sem alterações) ---
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
    let numbersToSearch = new Set([digitsOnly]);
    const brazilDDI = '55';
    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === 10 || digitsOnly.length === 11) numbersToSearch.add(brazilDDI + digitsOnly);
    }
    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        if (remainingDigits.startsWith('9')) numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        numbersToSearch.add(ddiDdd + '9' + remainingDigits);
    }
    return Array.from(numbersToSearch);
}
async function handleMediaMessage(supabase, whatsappConfig, message) {
    const mediaId = message.image?.id || message.video?.id || message.document?.id || message.audio?.id;
    if (!mediaId) return null;
    const mediaDetailsUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
    const mediaDetailsResponse = await fetch(mediaDetailsUrl, { headers: { 'Authorization': `Bearer ${whatsappConfig.whatsapp_permanent_token}` } });
    if (!mediaDetailsResponse.ok) return null;
    const mediaDetails = await mediaDetailsResponse.json();
    if (!mediaDetails.url) return null;
    const mediaFileResponse = await fetch(mediaDetails.url, { headers: { 'Authorization': `Bearer ${whatsappConfig.whatsapp_permanent_token}` } });
    if (!mediaFileResponse.ok) return null;
    const mediaBuffer = await mediaFileResponse.arrayBuffer();
    const fileName = message.document?.filename || `${message.type}_${mediaId}.${mediaDetails.mime_type.split('/')[1] || 'bin'}`;
    const filePath = `${message.from}/${Date.now()}_${fileName}`;
    await supabase.storage.from('whatsapp-media').upload(filePath, mediaBuffer, { contentType: mediaDetails.mime_type });
    const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
    return publicUrlData.publicUrl;
}

// -----------------------------------------------------------------------------
// ***** INÍCIO DAS NOVAS FUNÇÕES DA STELLA *****
// -----------------------------------------------------------------------------

// Função para ENVIAR mensagens de texto e SALVAR no banco
async function sendTextMessage(supabase, config, to, contactId, text) {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const payload = { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }, body: JSON.stringify(payload) });
    const responseData = await response.json();
    if (!response.ok) { console.error("ERRO ao enviar mensagem via WhatsApp:", responseData); return; }
    const messageId = responseData.messages?.[0]?.id;
    if (messageId) {
        await supabase.from('whatsapp_messages').insert({
            contato_id: contactId, message_id: messageId, sender_id: config.whatsapp_phone_number_id,
            receiver_id: to, content: text, sent_at: new Date().toISOString(),
            direction: 'outbound', status: 'sent', raw_payload: payload
        });
    }
}

// Função para buscar a "memória" da conversa
async function getConversationContext(supabase, phoneNumber) {
    const { data } = await supabase.from('whatsapp_conversations').select('context').eq('phone_number', phoneNumber).single();
    return data?.context || {};
}

// Função para salvar a "memória" da conversa
async function saveConversationContext(supabase, phoneNumber, context) {
    await supabase.from('whatsapp_conversations').upsert({ phone_number: phoneNumber, context, updated_at: new Date().toISOString() });
}

// Nova função que usa a IA para analisar um documento
async function analyzeDocumentWithAI(supabase, empreendimentoId, userQuestion) {
    console.log(`INFO: Analisando documento para empreendimento ${empreendimentoId} com a pergunta: "${userQuestion}"`);
    
    // 1. Encontrar o "book" de vendas do empreendimento
    const { data: anexo, error: anexoError } = await supabase
        .from('empreendimento_anexos')
        .select('caminho_arquivo')
        .eq('empreendimento_id', empreendimentoId)
        .eq('categoria_aba', 'marketing')
        .like('nome_arquivo', '%book%')
        .limit(1).single();

    if (anexoError || !anexo) {
        console.error("ERRO: Book de vendas não encontrado para análise.", anexoError);
        return "Não consegui encontrar o book de vendas para responder sua pergunta. Peço desculpas.";
    }

    // 2. Baixar o arquivo do Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('empreendimento-anexos')
        .download(anexo.caminho_arquivo);

    if (downloadError) {
        console.error("ERRO: Falha ao baixar o book para análise.", downloadError);
        return "Tive um problema ao acessar o book de vendas. Por favor, tente novamente mais tarde.";
    }

    // 3. Chamar a API interna que usa o Gemini
    const formData = new FormData();
    formData.append('file', fileData);
    formData.append('prompt', `Baseado no documento em anexo, responda a seguinte pergunta de forma clara e direta: "${userQuestion}"`);

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/empreendimentos/analyze-anexo`, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro desconhecido na API de análise');
        return result.analysis_result; // A resposta da IA
    } catch (error) {
        console.error("ERRO: Falha na chamada da API de análise de documento.", error);
        return "Não consegui analisar o documento no momento. Você poderia tentar reformular a pergunta?";
    }
}

// O NOVO CÉREBRO DA STELLA (com memória e capacidade de leitura)
async function processStellaLogic(supabase, config, messageText, senderPhone, contactId) {
    const texto = messageText.toLowerCase();
    
    // 1. Recuperar a memória da conversa
    let context = await getConversationContext(supabase, senderPhone);
    let empreendimentoId = context.empreendimentoId;
    let empreendimentoNome = context.empreendimentoNome;

    // 2. Tentar identificar um novo empreendimento na mensagem
    const palavras = texto.split(' ');
    for (const palavra of palavras) {
        if (!isNaN(parseInt(palavra))) {
            const { data: emp } = await supabase.from('empreendimentos').select('id, nome').eq('id', parseInt(palavra)).single();
            if (emp) {
                empreendimentoId = emp.id;
                empreendimentoNome = emp.nome;
                context = { empreendimentoId, empreendimentoNome }; // Reseta o contexto com o novo empreendimento
                break;
            }
        }
    }
    
    // 3. Se AINDA não sabemos de qual empreendimento falar, peça ajuda.
    if (!empreendimentoId) {
        await sendTextMessage(supabase, config, senderPhone, contactId, "Olá! Sou a Stella. Para que eu possa te ajudar, por favor, me diga o nome ou o código do empreendimento sobre o qual deseja informações.");
        return;
    }

    // 4. Se já sabemos o empreendimento, analisamos a intenção
    const querInfo = texto.includes('info') || texto.includes('informações');
    const querBook = texto.includes('book');
    const querTabela = texto.includes('tabela');

    let resposta;

    if (querBook) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('public_url, nome_arquivo').eq('empreendimento_id', empreendimentoId).eq('categoria_aba', 'marketing').like('nome_arquivo', '%book%').limit(1).single();
        resposta = anexo ? `Claro! Aqui está o link para o book do ${empreendimentoNome}:\n${anexo.public_url}` : `Não encontrei o book de apresentação para o ${empreendimentoNome}.`;
    
    } else if (querTabela) {
        const { data: anexo } = await supabase.from('empreendimento_anexos').select('public_url, nome_arquivo').eq('empreendimento_id', empreendimentoId).like('nome_arquivo', '%tabela%').limit(1).single();
        resposta = anexo ? `Com certeza! A tabela de vendas do ${empreendimentoNome} está aqui:\n${anexo.public_url}` : `Não localizei a tabela de vendas para o ${empreendimentoNome} no momento.`;
    
    } else if (querInfo) {
        const { data: emp } = await supabase.from('empreendimentos').select('nome, status, descricao_curta, address_street, neighborhood, city').eq('id', empreendimentoId).single();
        resposta = `Claro! Seguem as informações sobre o *${emp.nome}*:\n\n*Status:* ${emp.status}\n*Localização:* ${emp.address_street}, ${emp.neighborhood} - ${emp.city}\n\n${emp.descricao_curta}\n\nO que mais você gostaria de saber?`;
    
    } else {
        // Se não for um pedido simples, usamos a IA para LER o book e responder.
        resposta = await analyzeDocumentWithAI(supabase, empreendimentoId, messageText);
    }
    
    // 5. Enviar a resposta e salvar o contexto para a próxima mensagem
    await sendTextMessage(supabase, config, senderPhone, contactId, resposta);
    await saveConversationContext(supabase, senderPhone, context);
}

// -----------------------------------------------------------------------------
// WEBHOOK PRINCIPAL (POST e GET)
// -----------------------------------------------------------------------------
export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    try {
        const body = await request.json();
        const { data: whatsappConfig, error: configError } = await supabaseAdmin.from('configuracoes_whatsapp').select('*').limit(1).single();
        if (configError || !whatsappConfig) {
            console.error("ERRO CRÍTICO: Configurações do WhatsApp não encontradas.", configError);
            return new NextResponse(null, { status: 200 });
        }
        const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (messageEntry) {
            if (['audio', 'image', 'video', 'document'].includes(messageEntry.type)) {
                const publicUrl = await handleMediaMessage(supabaseAdmin, whatsappConfig, messageEntry);
                if (publicUrl) messageEntry[messageEntry.type].link = publicUrl;
            }
            const messageContent = getTextContent(messageEntry);
            const contactPhoneNumber = messageEntry.from;
            let contactId = null;
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones?.length > 0) contactId = matchingPhones[0].contato_id;
            const messageToSave = {
                contato_id: contactId, message_id: messageEntry.id, sender_id: messageEntry.from,
                receiver_id: whatsappConfig.whatsapp_phone_number_id, content: messageContent,
                sent_at: new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString(),
                direction: 'inbound', status: 'delivered', raw_payload: messageEntry,
            };
            await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);
            // ----- CHAMADA PARA A NOVA LÓGICA DA STELLA -----
            if (messageContent && messageEntry.type === 'text') {
                // Não precisa de 'await' aqui, para a resposta ao webhook ser imediata
                processStellaLogic(supabaseAdmin, whatsappConfig, messageContent, contactPhoneNumber, contactId);
            }
        }
        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 200 });
    }
}
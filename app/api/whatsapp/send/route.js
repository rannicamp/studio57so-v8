import { NextResponse } from 'next/server';
// Usaremos o createClient diretamente da biblioteca principal para criar um cliente seguro no servidor.
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    
    // Verificação de segurança para garantir que as chaves existem no ambiente da Netlify.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não foram encontradas.");
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    // Cria um cliente Supabase especial que usa a chave de administrador (service_role).
    // Isto é ESSENCIAL para passar pela sua política de segurança (RLS).
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log("INFO: Cliente Supabase Admin inicializado.");

    try {
        const body = await request.json();
        const { to, type, templateName, languageCode, components, text } = body;

        if (!to || !type) {
            return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
        }

        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id')
            .limit(1)
            .single();

        if (configError || !config) {
            console.error("ERRO: Não foi possível ler as configurações do WhatsApp.", configError);
            return NextResponse.json({ error: 'Credenciais do WhatsApp não encontradas.' }, { status: 500 });
        }

        const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID } = config;
        const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        let payload = {};
        let messageContentForDb = '';

        if (type === 'template') {
            payload = {
                messaging_product: 'whatsapp', to: to, type: 'template',
                template: { name: templateName, language: { code: languageCode || 'pt_BR' }, components: components || [] }
            };
            messageContentForDb = `Template: ${templateName}`;
        } else if (type === 'text') {
            payload = {
                messaging_product: 'whatsapp', to: to, type: 'text',
                text: { preview_url: true, body: text }
            };
            messageContentForDb = text;
        } else {
            return NextResponse.json({ error: 'Tipo de mensagem inválido.' }, { status: 400 });
        }

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("ERRO da API da Meta:", responseData);
            return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
        }

        const newMessageId = responseData.messages?.[0]?.id;
        if (!newMessageId) {
            console.error("ERRO: ID da mensagem não encontrado na resposta da Meta:", responseData);
            return NextResponse.json({ message: 'Mensagem enviada, mas não pôde ser salva (ID ausente).', data: responseData }, { status: 200 });
        }

        console.log(`INFO: Mensagem enviada via WhatsApp (ID: ${newMessageId}). Salvando no banco...`);

        const { data: contact } = await supabaseAdmin.from('contatos').select('id, empresa_id').eq('whatsapp', to).single();

        // Objeto final com todos os nomes de colunas CORRETOS.
        const messageToSave = {
            contato_id: contact?.id || null,
            enterprise_id: contact?.empresa_id || null,
            message_id: newMessageId,
            sender_id: WHATSAPP_PHONE_NUMBER_ID,
            receiver_id: to,
            content: messageContentForDb,
            sent_at: new Date().toISOString(),
            direction: 'outbound',
            status: 'sent',
            raw_payload: responseData,
        };

        const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);

        if (dbError) {
            console.error('ERRO ao inserir no banco:', dbError);
            return NextResponse.json({ message: 'Mensagem ENVIADA, mas falhou ao salvar no banco.', error: dbError.message }, { status: 206 });
        }

        console.log("SUCESSO: Mensagem salva no banco!");
        return NextResponse.json({ message: 'Mensagem enviada e salva com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO NA API:", error);
        return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
    }
}
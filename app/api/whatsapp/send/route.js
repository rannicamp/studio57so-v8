import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatarParaWhatsAppBR } from '@/utils/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await request.json();

        // Desestruturação dos dados recebidos
        // 🔥 ADICIONADO: 'organizacao_id' aqui
        let { to, type, text, link, caption, filename, templateName, languageCode, components, contact_id, custom_content, location, organizacao_id } = body;

        // Trava de Segurança
        if (!organizacao_id) {
            return NextResponse.json({ error: 'ID da organização não fornecido para o envio.' }, { status: 400 });
        }

        // --- 1. LIMPEZA E VALIDAÇÃO DO TELEFONE ---
        // formatarParaWhatsAppBR: remove DDI +55 e o 9º dígito de celulares BR (exigência da Meta API)
        const cleanPhone = formatarParaWhatsAppBR(to);

        if (!cleanPhone) {
            return NextResponse.json({ error: 'Número de telefone inválido ou vazio.' }, { status: 400 });
        }

        // --- 2. CONFIGURAÇÃO (AGORA BLINDADA) ---
        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*')
            .eq('organizacao_id', organizacao_id) // 🔥 O CADEADO ESTÁ AQUI! Busca só a config desta empresa
            .single();

        if (configError || !config) {
            return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada para esta organização.' }, { status: 500 });
        }

        // 🏆 Token permanente do System User tem prioridade sobre o token do banco (que pode expirar)
        const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || config.whatsapp_permanent_token;
        const phoneId = config.whatsapp_phone_number_id;

        // --- 3. PREPARAÇÃO DO PAYLOAD PARA META ---
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: type
        };

        // Define o conteúdo textual para salvar no banco depois
        let messageContentForDb = '';

        if (type === 'text') {
            payload.text = { body: text, preview_url: true };
            messageContentForDb = text;
        }
        else if (type === 'template') {
            payload.template = {
                name: templateName,
                language: { code: languageCode || 'pt_BR' },
                components: components || []
            };
            messageContentForDb = custom_content || `Template: ${templateName}`;
        }
        else if (type === 'image') {
            payload.image = { link: link, caption: caption || '' };
            messageContentForDb = caption || 'Imagem enviada';
        }
        else if (type === 'document') {
            payload.document = { link: link, caption: caption || '', filename: filename || 'documento.pdf' };
            messageContentForDb = caption || filename || 'Documento enviado';
        }
        else if (type === 'audio') {
            payload.audio = { link: link };
            messageContentForDb = 'Áudio enviado';
        }
        else if (type === 'video') {
            payload.video = { link: link, caption: caption || '' };
            messageContentForDb = caption || 'Vídeo enviado';
        }
        // --- NOVO BLOCO DE LOCALIZAÇÃO ---
        else if (type === 'location') {
            payload.location = {
                latitude: location.latitude,
                longitude: location.longitude,
                name: location.name || 'Localização',
                address: location.address || ''
            };
            messageContentForDb = `📍 Localização: ${location.latitude}, ${location.longitude}`;
        }

        console.log(`[WhatsApp Send] Enviando ${type} para ${cleanPhone}...`);

        // --- 4. TENTATIVA DE ENVIO (META API) ---
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        // --- 5. RESOLUÇÃO DO CONTATO ---
        let finalContactId = contact_id;
        if (!finalContactId) {
            try {
                // Aqui também é recomendado, no futuro, passar o organizacao_id para buscar apenas contatos da empresa
                const { data } = await supabaseAdmin.rpc('find_contact_smart', { phone_input: cleanPhone });
                finalContactId = data;
            } catch (e) {
                console.warn("Falha ao buscar contato por telefone:", e);
            }
        }

        // --- 6. TRATAMENTO DE ERRO ---
        if (!response.ok) {
            console.error('[WhatsApp Send Error] Falha Meta:', JSON.stringify(responseData));

            const errorMessage = responseData.error?.message || 'Erro desconhecido na Meta API';
            const errorPayload = responseData;

            await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId,
                sender_id: phoneId,
                receiver_id: cleanPhone,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'failed',
                raw_payload: errorPayload,
                error_message: errorMessage,
                organizacao_id: config.organizacao_id,
                media_url: link || null
            });

            return NextResponse.json({
                error: errorMessage,
                details: responseData
            }, { status: response.status });
        }

        // --- 7. CRIAÇÃO/ATUALIZAÇÃO DA CONVERSA (MÁGICA DO CHAT) ---
        const { data: conversationData, error: convError } = await supabaseAdmin
            .from('whatsapp_conversations')
            .upsert({
                phone_number: cleanPhone,
                contato_id: finalContactId,
                organizacao_id: config.organizacao_id,
                updated_at: new Date().toISOString(),
                last_direction: 'outbound',
                last_status: 'sent'
            }, { onConflict: 'phone_number' })
            .select()
            .single();

        if (convError) console.error('[WhatsApp Send] Erro Upsert Conversation:', convError);

        const conversationRecordId = conversationData?.id;

        // --- 8. SUCESSO (INSERE A MENSAGEM NO BANCO COM O VÍNCULO) ---
        const newMessageId = responseData.messages?.[0]?.id;

        if (newMessageId) {
            const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: finalContactId,
                message_id: newMessageId,
                sender_id: phoneId,
                receiver_id: cleanPhone,
                content: messageContentForDb,
                sent_at: new Date().toISOString(),
                direction: 'outbound',
                status: 'sent',
                raw_payload: JSON.stringify(payload),
                organizacao_id: config.organizacao_id,
                conversation_record_id: conversationRecordId, // 🔥 ELO DA CORRENTE FEITO!
                media_url: link || null,
                error_message: null
            });

            if (dbError) console.error('[WhatsApp Send] Erro DB:', dbError);

            // --- 9. ATUALIZA ÚLTIMA MENSAGEM NA CONVERSA ---
            if (!dbError && conversationRecordId) {
                // Como não temos o ID retornado do insert (porque não fizemos .select()), 
                // vamos atualizar a conversa com o ID da nova mensagem.
                const { data: insertedMsg } = await supabaseAdmin
                    .from('whatsapp_messages')
                    .select('id')
                    .eq('message_id', newMessageId)
                    .single();

                if (insertedMsg) {
                    await supabaseAdmin
                        .from('whatsapp_conversations')
                        .update({ last_message_id: insertedMsg.id })
                        .eq('id', conversationRecordId);
                }
            }
        }

        return NextResponse.json(responseData, { status: 200 });

    } catch (error) {
        console.error('[WhatsApp Send Fatal Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
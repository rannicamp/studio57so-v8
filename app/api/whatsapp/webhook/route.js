import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

// --- 1. CONFIGURAÇÃO ---
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        publicKey,
        privateKey
    );
}

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 2. PROCESSAMENTO DE MÍDIA ---
async function processIncomingMedia(supabaseAdmin, message, config, contatoId) {
    try {
        const type = message.type;
        const mediaId = message[type]?.id;
        const mimeType = message[type]?.mime_type;
        let fileName = message[type]?.filename;

        if (!mediaId) return null;

        if (!fileName) {
            const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
            fileName = `${type}_${mediaId}_${Date.now()}.${ext}`;
        }

        const cleanName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const folderPath = contatoId ? `received/${contatoId}/${year}/${month}` : `received/unassigned/${year}/${month}`;
        const filePath = `${folderPath}/${cleanName}`;

        console.log(`[Webhook] Baixando mídia ${mediaId} para: ${filePath}`);

        const urlResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!urlResponse.ok) throw new Error(`Erro URL Meta: ${urlResponse.statusText}`);
        const urlData = await urlResponse.json();
        if (!urlData.url) throw new Error('URL não retornada pela Meta');

        const fileResponse = await fetch(urlData.url, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!fileResponse.ok) throw new Error(`Erro Download: ${fileResponse.statusText}`);
        
        const fileBlob = await fileResponse.arrayBuffer();
        const fileSize = fileBlob.byteLength;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(filePath, fileBlob, { contentType: mimeType, upsert: true });

        if (uploadError) {
            console.error('[Webhook] Erro upload Supabase:', uploadError);
            return null;
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('whatsapp-media')
            .getPublicUrl(filePath);

        return {
            publicUrl: publicUrlData.publicUrl,
            storagePath: filePath,
            fileName: cleanName,
            fileSize: fileSize,
            mimeType: mimeType
        };

    } catch (error) {
        console.error('[Webhook] Erro processando mídia:', error);
        return null;
    }
}

// --- 3. NOTIFICAÇÃO ---
async function dispatchNotification(supabaseAdmin, organizacaoId, title, message, url) {
    try {
        const { data: users } = await supabaseAdmin
            .from('usuarios')
            .select('id, preferencias_notificacao')
            .eq('organizacao_id', organizacaoId);

        if (!users || users.length === 0) return;

        const notificationsToInsert = [];
        const pushPromises = [];

        for (const user of users) {
            const prefs = user.preferencias_notificacao;
            if (prefs && prefs.comercial === false) continue;

            notificationsToInsert.push({
                user_id: user.id,
                titulo: title,
                mensagem: message,
                link: url,
                lida: false,
                organizacao_id: organizacaoId,
                created_at: new Date().toISOString()
            });

            if (publicKey && privateKey) {
                const p = supabaseAdmin
                    .from('notification_subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .then(({ data: subs }) => {
                        if (!subs || subs.length === 0) return;
                        const payload = JSON.stringify({
                            title: title, body: message, url: url, icon: '/icons/icon-192x192.png', tag: 'whatsapp-msg'
                        });
                        return Promise.all(subs.map(sub => 
                            webPush.sendNotification(sub.subscription_data, payload).catch(err => {
                                if (err.statusCode === 410 || err.statusCode === 404) {
                                    supabaseAdmin.from('notification_subscriptions').delete().eq('id', sub.id).then();
                                }
                            })
                        ));
                    });
                pushPromises.push(p);
            }
        }

        if (notificationsToInsert.length > 0) {
            await supabaseAdmin.from('notificacoes').insert(notificationsToInsert);
        }
        await Promise.allSettled(pushPromises);

    } catch (error) {
        console.error('[Notification Error]', error);
    }
}

function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
    if (message.type === 'document') return message.document?.caption || message.document?.filename || 'Documento Recebido';
    if (message.type === 'image') return message.image?.caption || 'Imagem Recebida';
    if (message.type === 'audio') return 'Áudio Recebido';
    if (message.type === 'video') return message.video?.caption || 'Vídeo Recebido';
    if (message.type === 'voice') return 'Mensagem de Voz';
    return null;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const body = await request.json();
        
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*, organizacao_id')
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });

        const change = body.entry?.[0]?.changes?.[0]?.value;
        if (change?.statuses) return NextResponse.json({ status: 'ok' });

        const message = change?.messages?.[0];
        if (message) {
            const from = message.from; 

            // 1. DEDUP
            const { data: existingMsg } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id')
                .eq('message_id', message.id)
                .single();

            if (existingMsg) return NextResponse.json({ status: 'ok' });
            
            // 2. CONTATO
            const { data: foundId } = await supabaseAdmin.rpc('find_contact_by_phone', { phone_input: from });
            let contatoId = foundId;
            let contatoNome = `Lead (${from})`;
            let isNewLead = false;

            if (!contatoId) {
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id, is_awaiting_name_response: false
                }).select().single();
                contatoId = newContact.id;
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });
                // Funil padrão
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', config.organizacao_id).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: config.organizacao_id });
                }
            } else {
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    let textBody = message.type === 'text' ? message.text?.body : null;
                    if (textBody && existing.is_awaiting_name_response && textBody.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: textBody, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = textBody;
                    }
                }
            }
            
            // 3. CONVERSA (Garante que existe e atualiza org)
            const { data: conversationData } = await supabaseAdmin.from('whatsapp_conversations')
                .upsert({ 
                    phone_number: from, 
                    updated_at: new Date().toISOString(),
                    contato_id: contatoId,
                    organizacao_id: config.organizacao_id // Importante!
                }, { onConflict: 'phone_number' })
                .select()
                .single();

            const conversationRecordId = conversationData?.id;

            // 4. MENSAGEM E MÍDIA
            const isMedia = ['image', 'document', 'audio', 'video', 'voice'].includes(message.type);
            let content = getTextContent(message);
            let mediaData = null;
            let finalMessageId = null;

            if (isMedia) {
                const tempContent = content || (message.type === 'document' ? '📄 Documento (Processando...)' : '📎 Mídia (Baixando...)');
                
                const { data: insertedMediaMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: contatoId,
                    message_id: message.id, 
                    sender_id: from,
                    receiver_id: config.whatsapp_phone_number_id, 
                    content: tempContent,
                    sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                    direction: 'inbound', 
                    status: 'delivered', 
                    raw_payload: message,
                    media_url: null, 
                    organizacao_id: config.organizacao_id,
                    conversation_record_id: conversationRecordId // Vinculo
                }).select().single();
                
                finalMessageId = insertedMediaMsg?.id;

                // Download Async
                mediaData = await processIncomingMedia(supabaseAdmin, message, config, contatoId);

                if (mediaData && finalMessageId) {
                    if (!content) {
                        content = message.type === 'document' ? (mediaData.fileName || 'Documento') : 
                                  message.type === 'image' ? 'Imagem' : 
                                  message.type === 'audio' || message.type === 'voice' ? 'Áudio' : 'Mídia';
                    }
                    await supabaseAdmin.from('whatsapp_messages').update({
                        media_url: mediaData.publicUrl,
                        content: content
                    }).eq('id', finalMessageId);

                    await supabaseAdmin.from('whatsapp_attachments').insert({
                        contato_id: contatoId, message_id: message.id, storage_path: mediaData.storagePath,
                        public_url: mediaData.publicUrl, file_name: mediaData.fileName, file_type: mediaData.mimeType,
                        file_size: mediaData.fileSize, organizacao_id: config.organizacao_id, created_at: new Date().toISOString()
                    });
                }
            } else {
                const { data: insertedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                    contato_id: contatoId,
                    message_id: message.id, 
                    sender_id: from,
                    receiver_id: config.whatsapp_phone_number_id, 
                    content: content,
                    sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                    direction: 'inbound', 
                    status: 'delivered', 
                    raw_payload: message,
                    media_url: null,
                    organizacao_id: config.organizacao_id,
                    conversation_record_id: conversationRecordId // Vinculo
                }).select().single();
                finalMessageId = insertedMsg?.id;
            }

            // 5. ATUALIZAR CONVERSA COM ÚLTIMA MENSAGEM (O PULO DO GATO 🐈)
            if (conversationRecordId && finalMessageId) {
                await supabaseAdmin.from('whatsapp_conversations')
                    .update({ last_message_id: finalMessageId })
                    .eq('id', conversationRecordId);
            }

            // 6. Notificação
            if (content || mediaData) {
                let notifTitle = isNewLead ? '🎉 Novo Lead!' : `💬 Mensagem de ${contatoNome}`;
                let notifBody = mediaData ? `📎 Arquivo: ${content}` : (content?.substring(0, 100) || 'Nova mensagem');
                await dispatchNotification(supabaseAdmin, config.organizacao_id, notifTitle, notifBody, '/caixa-de-entrada');
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
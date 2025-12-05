import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

// --- 1. CONFIGURAÇÃO DO WEB PUSH ---
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        publicKey,
        privateKey
    );
}

// --- 2. INICIALIZAÇÃO DO SUPABASE (ADMIN) ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 3. FUNÇÃO AUXILIAR: PROCESSAR MÍDIA (DOWNLOAD DA META -> UPLOAD SUPABASE) ---
async function processIncomingMedia(supabaseAdmin, message, config) {
    try {
        const type = message.type;
        // Pega o ID da mídia e o nome do arquivo (se houver, senão gera um)
        const mediaId = message[type]?.id;
        const mimeType = message[type]?.mime_type;
        let fileName = message[type]?.filename; // Comum em documentos

        if (!mediaId) return null;

        // Se não tiver nome (imagens/áudio), geramos um
        if (!fileName) {
            const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
            fileName = `${type}_${mediaId}.${ext}`;
        }

        // Limpa o nome do arquivo
        const cleanName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        const filePath = `received/${cleanName}`; // Pasta 'received' para organizar

        // 1. Obter URL de download da API da Meta
        const urlResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        const urlData = await urlResponse.json();
        
        if (!urlData.url) {
            console.error('[Webhook] Falha ao obter URL da mídia:', urlData);
            return null;
        }

        // 2. Baixar o arquivo binário
        const fileResponse = await fetch(urlData.url, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        const fileBlob = await fileResponse.arrayBuffer();

        // 3. Fazer Upload para o Supabase (Bucket whatsapp-media)
        const { error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media') // IMPORTANTE: Bucket com hífen
            .upload(filePath, fileBlob, {
                contentType: mimeType,
                upsert: true
            });

        if (uploadError) {
            console.error('[Webhook] Erro upload Supabase:', uploadError);
            return null;
        }

        // 4. Gerar URL Pública
        const { data: publicUrlData } = supabaseAdmin.storage
            .from('whatsapp-media')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;

    } catch (error) {
        console.error('[Webhook] Erro processando mídia:', error);
        return null;
    }
}

// --- 4. NOTIFICAÇÃO ---
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
                            title: title,
                            body: message,
                            message: message,
                            url: url,
                            icon: '/icons/icon-192x192.png',
                            tag: 'whatsapp-msg'
                        });

                        return Promise.all(subs.map(sub => 
                            webPush.sendNotification(sub.subscription_data, payload)
                                .catch(err => {
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
        console.error('[WhatsApp Notification Error]', error);
    }
}

// --- FUNÇÕES DE ENVIO ---
async function sendTemplateMessage(supabase, config, to, contato, templateName, language) {
    if (!templateName) return;
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_phone_number_id}/messages`;
    const components = [{ type: 'body', parameters: [{ type: 'text', text: contato.nome || 'Cliente' }] }];
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${config.whatsapp_permanent_token}` 
            },
            body: JSON.stringify({
                messaging_product: "whatsapp", to: to, type: "template",
                template: { name: templateName, language: { code: language }, components }
            })
        });
        
        const data = await response.json();
        if (data.messages?.[0]?.id) {
            await supabase.from('whatsapp_messages').insert({
                contato_id: contato.id, message_id: data.messages[0].id, 
                sender_id: config.whatsapp_phone_number_id, receiver_id: to,
                content: `(Automação) Template: ${templateName}`, direction: 'outbound', 
                status: 'sent', sent_at: new Date().toISOString(), 
                organizacao_id: config.organizacao_id
            });
        }
    } catch (error) {
        console.error(`[Webhook] Erro ao enviar template:`, error);
    }
}

function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
    // Retorna descrição da mídia se for arquivo
    if (message.type === 'document') return message.document?.caption || message.document?.filename || 'Documento Recebido';
    if (message.type === 'image') return message.image?.caption || 'Imagem Recebida';
    if (message.type === 'audio') return 'Áudio Recebido';
    if (message.type === 'video') return message.video?.caption || 'Vídeo Recebido';
    return null;
}

// --- ROTA DE VERIFICAÇÃO ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- ROTA PRINCIPAL ---
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
            let content = getTextContent(message);
            const from = message.from; 
            let mediaUrl = null;

            // ---------------------------------------------------------
            // 0. PROCESSAMENTO DE MÍDIA (PDF, IMAGEM, ÁUDIO)
            // ---------------------------------------------------------
            if (['image', 'document', 'audio', 'video', 'voice'].includes(message.type)) {
                console.log(`[Webhook] Recebido arquivo do tipo: ${message.type}`);
                mediaUrl = await processIncomingMedia(supabaseAdmin, message, config);
                
                // Se baixou com sucesso e não tem caption, ajusta o content
                if (mediaUrl && !content) {
                    content = message.type === 'document' ? (message.document?.filename || 'Documento') : 
                              message.type === 'image' ? 'Imagem' : 
                              message.type === 'audio' || message.type === 'voice' ? 'Áudio' : 'Mídia';
                }
            }
            
            // ---------------------------------------------------------
            // 1. Identifica Contato
            // ---------------------------------------------------------
            const { data: foundId } = await supabaseAdmin.rpc('find_contact_by_phone', { phone_input: from });

            let contatoId = foundId;
            let contatoNome = `Lead (${from})`;
            let isNewLead = false;

            if (!contatoId) {
                console.log(`[Webhook] Contato não encontrado para ${from}. Criando novo Lead.`);
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: config.organizacao_id,
                    is_awaiting_name_response: false
                }).select().single();
                contatoId = newContact.id;
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: from, tipo: 'celular', organizacao_id: config.organizacao_id
                });

                // Funil e Automação (Simplificado)
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', config.organizacao_id).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) {
                        await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: config.organizacao_id });
                    }
                }
            } else {
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    // Se for texto simples e estiver aguardando nome, atualiza
                    if (message.type === 'text' && existing.is_awaiting_name_response && content && content.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: content, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = content;
                    }
                }
            }

            // ---------------------------------------------------------
            // 2. ATUALIZA/CRIA A CONVERSA
            // ---------------------------------------------------------
            await supabaseAdmin.from('whatsapp_conversations').upsert({ 
                phone_number: from, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'phone_number' });

            // ---------------------------------------------------------
            // 3. SALVA A MENSAGEM (AGORA COM MEDIA_URL)
            // ---------------------------------------------------------
            const { error: msgError } = await supabaseAdmin.from('whatsapp_messages').insert({
                contato_id: contatoId,
                message_id: message.id, 
                sender_id: from,
                receiver_id: config.whatsapp_phone_number_id, 
                content: content,
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound', 
                status: 'delivered', 
                raw_payload: message,
                media_url: mediaUrl, // <--- AQUI A URL PÚBLICA DO ARQUIVO
                organizacao_id: config.organizacao_id
            });

            if (msgError) console.error("[Webhook] Erro ao salvar mensagem:", msgError);
            
            // 4. Notificação
            if (content || mediaUrl) {
                let notifTitle = isNewLead ? '🎉 Novo Lead no WhatsApp!' : `💬 Mensagem de ${contatoNome}`;
                let notifBody = mediaUrl ? `📎 Enviou um arquivo: ${content}` : (content?.substring(0, 100) || 'Nova mensagem');

                await dispatchNotification(supabaseAdmin, config.organizacao_id, notifTitle, notifBody, '/caixa-de-entrada');
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
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

// Inicializa Supabase com chave de serviço (ADMIN) para poder gravar arquivos e dados
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- 2. PROCESSAMENTO DE MÍDIA (Organizado e Robusto) ---
async function processIncomingMedia(supabaseAdmin, message, config, contatoId) {
    try {
        const type = message.type;
        const mediaId = message[type]?.id;
        const mimeType = message[type]?.mime_type;
        let fileName = message[type]?.filename; // Comum em documentos

        if (!mediaId) return null;

        // Se não tiver nome (imagens/áudio), geramos um com timestamp para evitar conflito
        if (!fileName) {
            const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'bin';
            fileName = `${type}_${mediaId}_${Date.now()}.${ext}`;
        }

        // Limpa o nome do arquivo
        const cleanName = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

        // LÓGICA DE ORGANIZAÇÃO: received/{contato_id}/{ano}/{mes}/{arquivo}
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        // Se por acaso contatoId for nulo (raro), joga numa pasta 'unassigned'
        const folderPath = contatoId ? `received/${contatoId}/${year}/${month}` : `received/unassigned/${year}/${month}`;
        const filePath = `${folderPath}/${cleanName}`;

        console.log(`[Webhook] Baixando mídia ${mediaId} para: ${filePath}`);

        // 1. Obter URL de download da API da Meta
        const urlResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!urlResponse.ok) throw new Error(`Erro ao obter URL da mídia: ${urlResponse.statusText}`);
        
        const urlData = await urlResponse.json();
        if (!urlData.url) throw new Error('URL da mídia não retornada pela Meta');

        // 2. Baixar o arquivo binário
        const fileResponse = await fetch(urlData.url, {
            headers: { 'Authorization': `Bearer ${config.whatsapp_permanent_token}` }
        });
        
        if (!fileResponse.ok) throw new Error(`Erro ao baixar binário: ${fileResponse.statusText}`);
        
        const fileBlob = await fileResponse.arrayBuffer();
        const fileSize = fileBlob.byteLength;

        // 3. Fazer Upload para o Supabase (Bucket whatsapp-media)
        const { error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media')
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

        // Retorna objeto completo com metadados para salvar no banco depois
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

// --- 3. SISTEMA DE NOTIFICAÇÃO ---
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

function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
    if (message.type === 'document') return message.document?.caption || message.document?.filename || 'Documento Recebido';
    if (message.type === 'image') return message.image?.caption || 'Imagem Recebida';
    if (message.type === 'audio') return 'Áudio Recebido';
    if (message.type === 'video') return message.video?.caption || 'Vídeo Recebido';
    return null;
}

// --- ROTA DE VERIFICAÇÃO (GET) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && 
        searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- ROTA PRINCIPAL (POST) ---
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
            
            // ---------------------------------------------------------
            // 1. IDENTIFICA/CRIA CONTATO (PRIORIDADE ALTA)
            // Precisamos do ID do contato ANTES de salvar o arquivo para organizar a pasta
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

                // Funil (Padrão)
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
                    // Atualiza nome se estiver aguardando
                    let textBody = message.type === 'text' ? message.text?.body : null;
                    if (textBody && existing.is_awaiting_name_response && textBody.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: textBody, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = textBody;
                    }
                }
            }

            // ---------------------------------------------------------
            // 2. PROCESSAMENTO DE MÍDIA (AGORA COM ID DO CONTATO)
            // ---------------------------------------------------------
            let mediaData = null; // Objeto com url, path, size, etc.
            let content = getTextContent(message);

            if (['image', 'document', 'audio', 'video', 'voice'].includes(message.type)) {
                console.log(`[Webhook] Recebido arquivo do tipo: ${message.type}`);
                
                // Passamos o contatoId para organizar a pasta corretamente
                mediaData = await processIncomingMedia(supabaseAdmin, message, config, contatoId);
                
                // Ajusta o texto da mensagem caso seja vazia
                if (mediaData && !content) {
                    content = message.type === 'document' ? (mediaData.fileName || 'Documento') : 
                              message.type === 'image' ? 'Imagem' : 
                              message.type === 'audio' || message.type === 'voice' ? 'Áudio' : 'Mídia';
                }
            }

            // ---------------------------------------------------------
            // 3. ATUALIZA CONVERSA
            // ---------------------------------------------------------
            await supabaseAdmin.from('whatsapp_conversations').upsert({ 
                phone_number: from, 
                updated_at: new Date().toISOString() 
            }, { onConflict: 'phone_number' });

            // ---------------------------------------------------------
            // 4. SALVA A MENSAGEM
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
                media_url: mediaData?.publicUrl || null, // Salva a URL principal
                organizacao_id: config.organizacao_id
            });

            if (msgError) {
                console.error("[Webhook] Erro ao salvar mensagem:", msgError);
            } else if (mediaData) {
                // ---------------------------------------------------------
                // 5. SE TIVER MÍDIA, SALVA NOS ANEXOS (TABELA SEPARADA)
                // Isso cria um registro profissional do arquivo recebido
                // ---------------------------------------------------------
                await supabaseAdmin.from('whatsapp_attachments').insert({
                    contato_id: contatoId,
                    message_id: message.id, // Vincula pelo ID da Meta
                    storage_path: mediaData.storagePath,
                    public_url: mediaData.publicUrl,
                    file_name: mediaData.fileName,
                    file_type: mediaData.mimeType,
                    file_size: mediaData.fileSize,
                    organizacao_id: config.organizacao_id,
                    created_at: new Date().toISOString()
                }).catch(err => console.error('[Webhook] Erro salvando anexo:', err));
            }
            
            // 6. Notificação
            if (content || mediaData) {
                let notifTitle = isNewLead ? '🎉 Novo Lead no WhatsApp!' : `💬 Mensagem de ${contatoNome}`;
                let notifBody = mediaData ? `📎 Enviou um arquivo: ${content}` : (content?.substring(0, 100) || 'Nova mensagem');

                await dispatchNotification(supabaseAdmin, config.organizacao_id, notifTitle, notifBody, '/caixa-de-entrada');
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
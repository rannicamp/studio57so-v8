//app\api\whatsapp\webhook\route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- 1. CONFIGURAÇÃO ---
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

// Função auxiliar para logar no banco (Caixa Preta do Avião)
async function logWebhook(supabaseAdmin, level, message, payload) {
    try {
        await supabaseAdmin.from('whatsapp_webhook_logs').insert({
            log_level: level,
            message: message,
            payload: payload ? payload : null
        });
    } catch (e) {
        console.error('Falha ao gravar log no banco:', e);
    }
}

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

        // Limpa o nome do arquivo
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
            await logWebhook(supabaseAdmin, 'ERROR', 'Erro upload Supabase', uploadError);
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
        await logWebhook(supabaseAdmin, 'ERROR', 'Erro processando mídia', { error: error.message });
        return null;
    }
}

// --- 3. EXTRAÇÃO DE TEXTO ---
function getTextContent(message) {
    if (!message || !message.type) return null;
    if (message.type === 'text') return message.text?.body;
    
    if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
            return interactive.button_reply.title;
        }
        if (interactive.type === 'list_reply') {
            return interactive.list_reply.title;
        }
        return 'Interação recebida';
    }

    if (message.type === 'button') return message.button?.text;
    if (message.type === 'document') return message.document?.caption || message.document?.filename || 'Documento Recebido';
    if (message.type === 'image') return message.image?.caption || 'Imagem Recebida';
    if (message.type === 'audio') return 'Áudio Recebido';
    if (message.type === 'video') return message.video?.caption || 'Vídeo Recebido';
    if (message.type === 'voice') return 'Mensagem de Voz';
    return null;
}

// --- ROTAS ---

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
        
        // Log inicial para depuração
        // await logWebhook(supabaseAdmin, 'INFO', 'Webhook recebido', body); // Descomente se quiser logar TUDO (pode encher o banco)

        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*, organizacao_id')
            .single();

        if (configError || !config) {
            console.error('Configuração não encontrada:', configError);
            return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });
        }

        const change = body.entry?.[0]?.changes?.[0]?.value;
        
        // --- 1. ATUALIZAÇÃO DE STATUS (VISTOS) ---
        if (change?.statuses) {
            const statusUpdate = change.statuses[0];
            const newStatus = statusUpdate.status; 
            const messageId = statusUpdate.id;

            await supabaseAdmin
                .from('whatsapp_messages')
                .update({ status: newStatus })
                .eq('message_id', messageId);

            return NextResponse.json({ status: 'status-updated' });
        }

        // --- 2. MENSAGEM RECEBIDA ---
        const message = change?.messages?.[0];
        if (message) {
            console.log('[Webhook] Mensagem recebida:', JSON.stringify(message));
            
            // Grava log da mensagem recebida para garantir rastreabilidade
            await logWebhook(supabaseAdmin, 'INFO', 'Mensagem Recebida - Inicio Processamento', message);

            const from = message.from; 

            // A. DEDUP (Evitar duplicidade)
            const { data: existingMsg } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id')
                .eq('message_id', message.id)
                .maybeSingle();

            if (existingMsg) {
                console.log('Mensagem duplicada ignorada:', message.id);
                return NextResponse.json({ status: 'ok', info: 'duplicated' });
            }
            
            // B. CONTATO
            const orgId = config.organizacao_id;
            let contatoId = null;
            let contatoNome = `Lead (${from})`;
            
            // 1. Tenta achar na tabela TELEFONES usando os últimos 8 dígitos (busca inteligente)
            const phoneSuffix = from.slice(-8); 
            const { data: telefoneExistente } = await supabaseAdmin
                .from('telefones')
                .select('contato_id')
                .eq('organizacao_id', orgId)
                .ilike('telefone', `%${phoneSuffix}%`) 
                .limit(1)
                .maybeSingle();

            if (telefoneExistente) {
                console.log(`[Smart Search] Contato encontrado via telefone: ${telefoneExistente.contato_id}`);
                contatoId = telefoneExistente.contato_id;
            } else {
                // 2. Backup: conversa existente
                const { data: conversaExistente } = await supabaseAdmin
                    .from('whatsapp_conversations')
                    .select('contato_id')
                    .eq('phone_number', from)
                    .eq('organizacao_id', orgId)
                    .maybeSingle();
                
                if (conversaExistente?.contato_id) {
                    contatoId = conversaExistente.contato_id;
                }
            }

            // 3. Novo Lead (Se não achou ninguém)
            if (!contatoId) {
                console.log('Criando novo contato Lead...');
                const { data: newContact, error: createError } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, 
                    tipo_contato: 'Lead', // Certifique-se que seu banco aceita 'Lead'. Se for ENUM, verifique maiúsculas/minúsculas.
                    organizacao_id: orgId, 
                    is_awaiting_name_response: false
                }).select().single();
                
                if (createError) {
                    console.error('Erro CRÍTICO ao criar contato:', createError);
                    await logWebhook(supabaseAdmin, 'CRITICAL', 'Erro ao criar contato', createError);
                    // Não retornamos erro 500 para não travar a fila do WhatsApp, mas logamos o erro
                    // Tenta continuar sem contato_id ou aborta? Melhor abortar a inserção da mensagem se não tem dono.
                    return NextResponse.json({ status: 'error', details: 'Falha ao criar contato' });
                }

                contatoId = newContact.id;
                
                const cleanPhone = from.replace(/[^0-9]/g, '');
                
                // Insere telefone
                const { error: phoneError } = await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, 
                    telefone: cleanPhone, 
                    tipo: 'celular', 
                    organizacao_id: orgId
                });

                if (phoneError) {
                    console.error('Erro ao salvar telefone:', phoneError);
                    await logWebhook(supabaseAdmin, 'ERROR', 'Erro ao salvar telefone', phoneError);
                }
                
                // Insere no Funil (Lógica de Negócio)
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', orgId).limit(1).maybeSingle();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).maybeSingle();
                    if (col) {
                         await supabaseAdmin.from('contatos_no_funil').insert({ 
                             contato_id: contatoId, 
                             coluna_id: col.id, 
                             organizacao_id: orgId 
                        });
                    }
                }
            } else {
                // Atualiza nome se necessário (Lógica existente)
                const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
                if (existing) {
                    contatoNome = existing.nome;
                    let textBody = getTextContent(message);
                    if (textBody && existing.is_awaiting_name_response && textBody.length > 2) {
                        await supabaseAdmin.from('contatos').update({ nome: textBody, is_awaiting_name_response: false }).eq('id', contatoId);
                        contatoNome = textBody;
                    }
                }
            }
            
            // C. CONVERSA (Upsert)
            const { data: conversationData, error: convError } = await supabaseAdmin.from('whatsapp_conversations')
                .upsert({ 
                    phone_number: from, 
                    updated_at: new Date().toISOString(),
                    contato_id: contatoId,
                    organizacao_id: config.organizacao_id
                }, { onConflict: 'phone_number' })
                .select()
                .single();

            if (convError) {
                console.error('Erro ao atualizar conversa:', convError);
                await logWebhook(supabaseAdmin, 'ERROR', 'Erro upsert conversa', convError);
                // Continua mesmo com erro na conversa para tentar salvar a mensagem
            }

            const conversationRecordId = conversationData?.id || null;

            // D. INSERÇÃO DA MENSAGEM
            const isMedia = ['image', 'document', 'audio', 'video', 'voice', 'sticker'].includes(message.type);
            let content = getTextContent(message);
            let mediaData = null;
            let finalMessageId = null;

            // Preparação do objeto de mensagem
            const messagePayload = {
                contato_id: contatoId,
                message_id: message.id, 
                sender_id: from,
                receiver_id: config.whatsapp_phone_number_id, 
                content: content || '[Processando...]',
                sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                direction: 'inbound', 
                status: 'delivered', 
                is_read: false, 
                raw_payload: message,
                media_url: null, 
                organizacao_id: config.organizacao_id,
                conversation_record_id: conversationRecordId
            };

            if (isMedia) {
                messagePayload.content = content || (message.type === 'document' ? '📄 Documento (Processando...)' : '📎 Mídia (Baixando...)');
                
                const { data: insertedMediaMsg, error: msgError } = await supabaseAdmin.from('whatsapp_messages')
                    .insert(messagePayload)
                    .select()
                    .single();

                if (msgError) {
                    throw new Error(`Erro insert msg media: ${msgError.message}`);
                }
                
                finalMessageId = insertedMediaMsg?.id;

                // Processa mídia em background (await aqui trava o webhook? Não, é rápido, mas idealmente seria fila)
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
                        contato_id: contatoId, 
                        message_id: message.id, 
                        storage_path: mediaData.storagePath,
                        public_url: mediaData.publicUrl, 
                        file_name: mediaData.fileName, 
                        file_type: mediaData.mimeType,
                        file_size: mediaData.fileSize, 
                        organizacao_id: config.organizacao_id, 
                        created_at: new Date().toISOString()
                    });
                }
            } else {
                // Mensagem de Texto Simples
                messagePayload.content = content || '[Interação desconhecida]';
                
                const { data: insertedMsg, error: msgError } = await supabaseAdmin.from('whatsapp_messages')
                    .insert(messagePayload)
                    .select()
                    .single();
                
                if (msgError) {
                    console.error('Erro ao inserir mensagem texto:', msgError);
                    await logWebhook(supabaseAdmin, 'CRITICAL', 'Erro insert mensagem', msgError);
                    throw new Error(msgError.message);
                }

                finalMessageId = insertedMsg?.id;
            }

            // E. ATUALIZAR CONVERSA (Última mensagem)
            if (conversationRecordId && finalMessageId) {
                const { data: currentConv } = await supabaseAdmin
                    .from('whatsapp_conversations')
                    .select('unread_count')
                    .eq('id', conversationRecordId)
                    .single();
                
                const currentCount = currentConv?.unread_count || 0;

                await supabaseAdmin.from('whatsapp_conversations')
                    .update({ 
                        last_message_id: finalMessageId,
                        unread_count: currentCount + 1, 
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversationRecordId);
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        // Tenta logar o erro fatal no banco se possível
        try {
            const supabaseAdmin = getSupabaseAdmin();
            await logWebhook(supabaseAdmin, 'FATAL', 'Crash no Webhook', { error: error.message, stack: error.stack });
        } catch(e) {}

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
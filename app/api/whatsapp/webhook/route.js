import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// import { enviarNotificacao } from '@/utils/notificacoes'; // Removido para evitar duplicidade com o Trigger do Banco

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
        
        const { data: config } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('*, organizacao_id')
            .single();

        if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 500 });

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
            const from = message.from; 

            // A. DEDUP (Evitar duplicidade)
            const { data: existingMsg } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id')
                .eq('message_id', message.id)
                .single();

            if (existingMsg) return NextResponse.json({ status: 'ok' });
            
            // B. CONTATO
            const orgId = config.organizacao_id;
            let contatoId = null;
            let contatoNome = `Lead (${from})`;
            let isNewLead = false;

            // 1. Tenta achar na tabela TELEFONES usando os últimos 8 dígitos
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

            // 3. Novo Lead
            if (!contatoId) {
                isNewLead = true;
                const { data: newContact } = await supabaseAdmin.from('contatos').insert({
                    nome: contatoNome, tipo_contato: 'Lead', organizacao_id: orgId, is_awaiting_name_response: false
                }).select().single();
                
                contatoId = newContact.id;
                
                const cleanPhone = from.replace(/[^0-9]/g, '');
                // Trigger do banco vincula conversas automaticamente
                await supabaseAdmin.from('telefones').insert({
                    contato_id: contatoId, telefone: cleanPhone, tipo: 'celular', organizacao_id: orgId
                });
                
                const { data: funil } = await supabaseAdmin.from('funis').select('id').eq('organizacao_id', orgId).limit(1).single();
                if (funil) {
                    const { data: col } = await supabaseAdmin.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem').limit(1).single();
                    if (col) await supabaseAdmin.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: col.id, organizacao_id: orgId });
                }
            } else {
                // Atualiza nome se necessário
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
            const { data: conversationData } = await supabaseAdmin.from('whatsapp_conversations')
                .upsert({ 
                    phone_number: from, 
                    updated_at: new Date().toISOString(),
                    contato_id: contatoId,
                    organizacao_id: config.organizacao_id
                }, { onConflict: 'phone_number' })
                .select()
                .single();

            const conversationRecordId = conversationData?.id;

            // D. INSERÇÃO DA MENSAGEM
            const isMedia = ['image', 'document', 'audio', 'video', 'voice', 'sticker'].includes(message.type);
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
                    is_read: false, 
                    raw_payload: message,
                    media_url: null, 
                    organizacao_id: config.organizacao_id,
                    conversation_record_id: conversationRecordId
                }).select().single();
                
                finalMessageId = insertedMediaMsg?.id;

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
                    content: content || '[Interação desconhecida]',
                    sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                    direction: 'inbound', 
                    status: 'delivered', 
                    is_read: false, 
                    raw_payload: message,
                    media_url: null, 
                    organizacao_id: config.organizacao_id,
                    conversation_record_id: conversationRecordId
                }).select().single();
                finalMessageId = insertedMsg?.id;
            }

            // E. ATUALIZAR CONVERSA
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

            // F. NOTIFICAÇÃO CENTRALIZADA (REMOVIDA/DESATIVADA)
            // O motivo: Agora utilizamos Triggers no Banco de Dados para gerar as notificações
            // de forma garantida e centralizada, evitando duplicidade (uma do código JS + uma do SQL).
            /* if (content || mediaData) {
               // ... código antigo removido ...
            }
            */
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Erro fatal:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
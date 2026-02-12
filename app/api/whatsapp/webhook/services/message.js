// app/api/whatsapp/webhook/services/message.js
import { getTextContent, logWebhook } from './helpers';
import { processIncomingMedia } from './media';

// Trata Reações (Joinha, Coração, etc)
export async function handleReaction(supabaseAdmin, reaction, from) {
    const targetMessageId = reaction.message_id;
    const emoji = reaction.emoji;

    console.log(`[MessageService] Reação: ${emoji} na msg ${targetMessageId}`);

    const { error } = await supabaseAdmin
        .from('whatsapp_messages')
        .update({ 
            reaction_data: { 
                emoji: emoji, 
                reacted_at: new Date().toISOString(),
                reactor_id: from 
            } 
        })
        .eq('message_id', targetMessageId);
        
    return { status: 'reaction_processed', error };
}

// Trata Mensagens Normais (Texto/Mídia)
export async function handleMessageInsert(supabaseAdmin, message, config, contatoId, conversationRecordId) {
    const from = message.from;
    const isMedia = ['image', 'document', 'audio', 'video', 'voice', 'sticker'].includes(message.type);
    let content = getTextContent(message);
    let mediaData = null;
    let finalMessageId = null;

    // Payload base
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
        // Insere temporário enquanto baixa
        messagePayload.content = content || '📎 Baixando mídia...';
        
        const { data: insertedMediaMsg, error: msgError } = await supabaseAdmin.from('whatsapp_messages')
            .insert(messagePayload)
            .select().single();

        if (msgError) throw msgError;
        finalMessageId = insertedMediaMsg?.id;

        // Baixa a mídia (usa o service media.js)
        mediaData = await processIncomingMedia(supabaseAdmin, message, config, contatoId);

        if (mediaData && finalMessageId) {
            // Atualiza com o link final
            await supabaseAdmin.from('whatsapp_messages').update({
                media_url: mediaData.publicUrl,
                content: content // Reafirma o conteúdo correto
            }).eq('id', finalMessageId);
            
            // Salva na tabela de anexos para galeria
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
        // Texto simples ou interativo
        messagePayload.content = content || '[Desconhecido]';
        const { data: insertedMsg, error: msgError } = await supabaseAdmin.from('whatsapp_messages')
            .insert(messagePayload)
            .select().single();
        
        if (msgError) throw msgError;
        finalMessageId = insertedMsg?.id;
    }

    // Atualiza o contador da conversa e o snippet da última mensagem
    if (conversationRecordId && finalMessageId) {
        // Busca contador atual para incrementar atomicamente (ou quase)
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
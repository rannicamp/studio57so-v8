// app/api/whatsapp/webhook/services/message.js
import { getTextContent, logWebhook } from './helpers';
import { processIncomingMedia } from './media';

import { transcribeAudioSync } from './ai';

// Trata Reações (Joinha, Coração, etc)
export async function handleReaction(supabaseAdmin, reaction, from) {
 try {
  const targetMessageId = reaction.message_id;
  const emoji = reaction.emoji;

  console.log(`[MessageService] Reação: ${emoji} na msg ${targetMessageId}`);

  const { error } = await supabaseAdmin
  .from('whatsapp_messages')
  .update({ reaction_data: { emoji: emoji, reacted_at: new Date().toISOString(),
  reactor_id: from } })
  .eq('message_id', targetMessageId);
  return { status: 'reaction_processed', error };
 } catch(err) {
  console.error("Edge catch", err)
  return { error: err }
 }
}

// Trata Mensagens Normais (Texto/Mídia)
export async function handleMessageInsert(supabaseAdmin, message, config, contatoId, conversationRecordId) {
 try {
  const from = message.from;
  const isMedia = ['image', 'document', 'audio', 'video', 'voice', 'sticker'].includes(message.type);
  let content = getTextContent(message);
  let mediaData = null;
  let finalMessageId = null;

  // Payload base
  const messagePayload = {
  contato_id: contatoId,
  message_id: message.id, sender_id: from,
  receiver_id: config.whatsapp_phone_number_id, content: content || '[Processando...]',
  sent_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  direction: 'inbound', status: 'delivered', is_read: false, raw_payload: message,
  media_url: null, organizacao_id: config.organizacao_id,
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
  // 1. Hook de Transcrição para Áudios (Gemini)
  let finalContent = content; // texto original se houver legenda 
  if (['audio', 'voice'].includes(message.type)) {
     const transcricao = await transcribeAudioSync(mediaData.publicUrl, mediaData.mimeType);
     if (transcricao) {
        finalContent = `🎙️ *Transcrição:* _${transcricao}_`;
     } else {
        finalContent = null; // vazio pra ficar igual whatsapp nativo se falhar
     }
  }

  // Atualiza com o link final
  await supabaseAdmin.from('whatsapp_messages').update({
  media_url: mediaData.publicUrl,
  content: finalContent // Reafirma o conteúdo (seja transcrito ou normal)
  }).eq('id', finalMessageId);
  // Salva na tabela de anexos para galeria
  await supabaseAdmin.from('whatsapp_attachments').insert({
  contato_id: contatoId, message_id: message.id, storage_path: mediaData.storagePath,
  public_url: mediaData.publicUrl, file_name: mediaData.fileName, file_type: mediaData.mimeType,
  file_size: mediaData.fileSize, organizacao_id: config.organizacao_id, created_at: new Date().toISOString()
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

  // Atualiza o snippet da última mensagem e incrementa o contador PARA TODOS os usuários
  if (conversationRecordId && finalMessageId) {
  // Chama a nova RPC inteligente que cria bolinhas individuais para todos da Organização
  await supabaseAdmin.rpc('increment_whatsapp_unreads', {
     v_conversation_id: conversationRecordId,
     v_org_id: config.organizacao_id
  });

  // Atualiza apenas a last_message para a UI
  await supabaseAdmin.from('whatsapp_conversations')
  .update({ 
     last_message_id: finalMessageId, 
     updated_at: new Date().toISOString()
  })
  .eq('id', conversationRecordId);
  }
 } catch (err){
  console.error("Edge catch prevent:", err)
 }
}
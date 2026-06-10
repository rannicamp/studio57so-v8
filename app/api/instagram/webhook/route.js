// app/api/instagram/webhook/route.js
// Webhook para receber DMs do Instagram em tempo real via Meta Conversations API
// VERSÃO 2.0 — Robustez copiada do WhatsApp: logs, deduplicação segura, resposta rápida
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Função de log centralizada (copiada do padrão WhatsApp)
async function logWebhook(supabase, level, message, payload = {}) {
 try {
 // Tenta logar na tabela webhook_logs se existir, senão só console
 console.log(`[Instagram Webhook][${level}] ${message}`, JSON.stringify(payload).substring(0, 500));
 } catch (e) {
 // Silencioso — log nunca pode derrubar o webhook
 }
}

// --- ROTA GET (Verificação do Token no Painel da Meta) ---
export async function GET(request) {
 const { searchParams } = new URL(request.url);
 const mode = searchParams.get('hub.mode');
 const token = searchParams.get('hub.verify_token');
 const challenge = searchParams.get('hub.challenge');

 console.log('[Instagram Webhook] GET - Verificação recebida. Mode:', mode);

 if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
 console.log('[Instagram Webhook] ✅ Verificação aprovada!');
 return new NextResponse(challenge, { status: 200 });
 }

 console.error('[Instagram Webhook] ❌ Falha. Token inválido recebido:', token);
 return new NextResponse('Token Incorreto', { status: 403 });
}

// --- ROTA POST (Recebimento de Mensagens em Tempo Real) ---
export async function POST(request) {
 const supabase = getSupabaseAdmin();

 // ⚡ REGRA DE OURO: A Meta exige resposta em menos de 5 segundos.
 // Respondemos 200 IMEDIATAMENTE e processamos em background.
 // Isso evita que a Meta reenvie o webhook por timeout e crie mensagens duplicadas.
 const body = await request.json().catch(() => null);

 // Se o payload veio vazio ou mal-formado, ignora sem erro
 if (!body) {
 return NextResponse.json({ status: 'ignored_empty_body' });
 }

 // Processa de forma assíncrona (não bloqueante — "fire and forget")
 processWebhookPayload(supabase, body).catch(e => {
 console.error('[Instagram Webhook] Erro no processamento assíncrono:', e.message);
 });

 // Responde 200 para a Meta imediatamente
 return NextResponse.json({ status: 'ok' });
}

// ─── PROCESSADOR PRINCIPAL (Rodando em Background) ────────────────────────────
async function processWebhookPayload(supabase, body) {
 try {
 await logWebhook(supabase, 'INFO', 'Webhook recebido', { object: body.object });

 // A Meta pode enviar múltiplas entries simultaneamente
 const entries = body.entry || [];
 for (const entry of entries) {
 await processEntry(supabase, entry);
 }
 } catch (error) {
 console.error('[Instagram Webhook] ERRO FATAL no processamento:', error.message);
 }
}

// ─── PROCESSADOR DE CADA ENTRY ────────────────────────────────────────────────
async function processEntry(supabase, entry) {
 // 1. Tentar o formato "messaging" (DMs — via Conversas API)
 const messagingEvents = entry.messaging || [];
 for (const event of messagingEvents) {
 await processMessagingEvent(supabase, event, entry.id);
 }

 // 2. Tentar o formato "changes" (Webhooks da Graph API v20+)
 const changes = entry.changes || [];
 for (const change of changes) {
 if (change.field === 'messages' || change.field === 'message_requests') {
 const value = change.value || {};
 if (value.messages) {
 for (const msg of value.messages) {
 await processGraphAPIMessage(supabase, msg, value, entry.id);
 }
 }
 }
 }
}

// ─── PROCESSADOR: FORMATO MESSAGING (CONVERSAS API) ──────────────────────────
async function processMessagingEvent(supabase, messaging, entryIgId) {
  const { sender, recipient, message, timestamp } = messaging;

  // Ignora eventos sem mensagem (like reactions, etc.)
  if (!message) {
    return;
  }

  let messageText = message.text || null;
  let messageType = 'text';
  let snippetText = null;

  // Verifica se há anexos de mídia (foto, sticker, vídeo)
  if (message.attachments && message.attachments.length > 0) {
    const att = message.attachments[0];
    const url = att.payload?.url;
    if (url) {
      messageText = url;
      messageType = att.type || 'media';
      snippetText = messageType === 'video' ? '🎥 Vídeo' : '📷 Foto';
    }
  }

  // Fallback caso tenha anexo mas não conseguimos ler a URL do payload
  if (!messageText && message.attachments) {
    messageText = '[Mídia recebida]';
    messageType = 'media';
    snippetText = '📷 Foto';
  }

  const senderIgId = sender?.id;
  const recipientIgId = recipient?.id || entryIgId;
  const messageId = message.mid;

  if (!senderIgId || !recipientIgId || !messageId || !messageText) {
    await logWebhook(supabase, 'WARN', 'Evento com campos obrigatórios ausentes ou sem conteúdo', { sender, recipient, mid: messageId });
    return;
  }

  await saveInstaMessage(supabase, {
    senderIgId,
    recipientIgId,
    messageId,
    messageText,
    messageType,
    snippetText,
    timestamp,
    messageObj: message,
  });
}

// ─── PROCESSADOR: FORMATO GRAPH API (changes > messages) ─────────────────────
async function processGraphAPIMessage(supabase, msg, value, entryIgId) {
  const recipientIgId = value.recipient_id || entryIgId;
  const senderIgId = msg.from?.id || msg.sender_id;
  const messageId = msg.id;

  let messageText = msg.text || msg.message || null;
  let messageType = 'text';
  let snippetText = null;

  // Verifica se há anexos de mídia
  if (msg.attachments && msg.attachments.length > 0) {
    const att = msg.attachments[0];
    const url = att.payload?.url;
    if (url) {
      messageText = url;
      messageType = att.type || 'media';
      snippetText = messageType === 'video' ? '🎥 Vídeo' : '📷 Foto';
    }
  }

  // Fallback
  if (!messageText && msg.attachments) {
    messageText = '[Mídia recebida]';
    messageType = 'media';
    snippetText = '📷 Foto';
  }

  if (!senderIgId || !recipientIgId || !messageId || !messageText) {
    return; // Ignora silenciosamente
  }

  await saveInstaMessage(supabase, {
    senderIgId,
    recipientIgId,
    messageId,
    messageText,
    messageType,
    snippetText,
    timestamp: msg.timestamp,
    messageObj: msg,
  });
}

// ─── NÚCLEO: SALVAR MENSAGEM NO BANCO ────────────────────────────────────────
 await logWebhook(supabase, 'ERROR', 'Erro ao salvar mensagem', { error: msgError.message });
 return;
 }

 await logWebhook(supabase, 'INFO',
 `✅ Mensagem de @${senderUsername || senderIgId} salva na Org ${orgId}`,
 { thread_id: threadId, message_id: messageId }
 );
}

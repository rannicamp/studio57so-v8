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

    // Ignora eventos sem mensagem de texto (like reactions, etc.)
    if (!message) {
        return;
    }

    // Suporte a texto e stickers
    const messageText = message.text || (message.attachments ? '[Mídia recebida]' : null);
    if (!messageText) {
        await logWebhook(supabase, 'INFO', 'Evento sem conteúdo processável, ignorando', { keys: Object.keys(messaging) });
        return;
    }

    const senderIgId = sender?.id;
    const recipientIgId = recipient?.id || entryIgId;
    const messageId = message.mid;

    if (!senderIgId || !recipientIgId || !messageId) {
        await logWebhook(supabase, 'WARN', 'Evento com campos obrigatórios ausentes', { sender, recipient, mid: messageId });
        return;
    }

    await saveInstaMessage(supabase, {
        senderIgId,
        recipientIgId,
        messageId,
        messageText,
        timestamp,
        messageObj: message,
    });
}

// ─── PROCESSADOR: FORMATO GRAPH API (changes > messages) ─────────────────────
async function processGraphAPIMessage(supabase, msg, value, entryIgId) {
    const recipientIgId = value.recipient_id || entryIgId;
    const senderIgId = msg.from?.id || msg.sender_id;
    const messageId = msg.id;
    const messageText = msg.text || msg.message || (msg.attachments ? '[Mídia recebida]' : null);

    if (!senderIgId || !recipientIgId || !messageId || !messageText) {
        return; // Ignora silenciosamente
    }

    await saveInstaMessage(supabase, {
        senderIgId,
        recipientIgId,
        messageId,
        messageText,
        timestamp: msg.timestamp,
        messageObj: msg,
    });
}

// ─── NÚCLEO: SALVAR MENSAGEM NO BANCO ────────────────────────────────────────
async function saveInstaMessage(supabase, { senderIgId, recipientIgId, messageId, messageText, timestamp, messageObj }) {
    // 1. Buscar a organização dona desta conta Instagram
    const { data: integracao } = await supabase
        .from('integracoes_meta')
        .select('id, organizacao_id, page_access_token, instagram_business_account_id')
        .eq('instagram_business_account_id', recipientIgId)
        .eq('is_active', true)
        .maybeSingle();

    if (!integracao) {
        // Tentativa alternativa: buscar pela env (conta legada)
        const legacyIgAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
        if (recipientIgId !== legacyIgAccountId) {
            await logWebhook(supabase, 'WARN', `Nenhuma integração para conta IG: ${recipientIgId}. Ignorando.`);
            return;
        }
        // Se for a conta legada, usa as variáveis de ambiente (modo compatibilidade)
        await logWebhook(supabase, 'WARN', 'Usando credenciais legadas de ambiente (sem integracoes_meta)');
    }

    const orgId = integracao?.organizacao_id || null;
    const accessToken = integracao?.page_access_token || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    // 2. Deduplicação protegida — verifica se a mensagem já existe
    const { data: existingMsg } = await supabase
        .from('instagram_messages')
        .select('id')
        .eq('message_id', messageId)
        .maybeSingle();

    if (existingMsg) {
        await logWebhook(supabase, 'INFO', `Mensagem duplicada ignorada: ${messageId}`);
        return;
    }

    // 3. Buscar dados do remetente via Graph API (com fallback gracioso)
    let senderName = `Usuário ${String(senderIgId).slice(-6)}`;
    let senderUsername = null;
    let senderPicUrl = null;

    if (accessToken) {
        try {
            // Usa AbortController + setTimeout (compatível com TODAS as versões do Node.js)
            // AbortSignal.timeout() não é suportado no Node.js < 19
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const profileRes = await fetch(
                `https://graph.facebook.com/v20.0/${senderIgId}?fields=name,username,profile_pic&access_token=${accessToken}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (!profileData.error) {
                    senderName = profileData.name || senderName;
                    senderUsername = profileData.username || null;
                    senderPicUrl = profileData.profile_pic || null;
                    console.log(`[Instagram Webhook] Perfil obtido: ${senderName} @${senderUsername}`);
                } else {
                    console.warn(`[Instagram Webhook] Graph API retornou erro de perfil:`, profileData.error?.message);
                }
            } else {
                console.warn(`[Instagram Webhook] Graph API status ${profileRes.status} ao buscar perfil de ${senderIgId}`);
            }
        } catch (e) {
            // Timeout ou erro de rede — continua com o nome padrão (não quebra o fluxo)
            console.warn('[Instagram Webhook] Perfil não obtido:', e.message);
        }
    }

    // 4. Montar a thread_id composta: conta_instagram + id_do_remetente
    const threadId = `${recipientIgId}_${senderIgId}`;
    const sentAt = timestamp
        ? new Date(typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString()
        : new Date().toISOString();

    // 5. Upsert da conversa (cria se não existe, atualiza se já existe)
    const { data: conversation, error: convError } = await supabase
        .from('instagram_conversations')
        .upsert({
            organizacao_id: orgId,
            thread_id: threadId,
            instagram_account_id: recipientIgId,
            participant_id: senderIgId,
            participant_name: senderName,
            participant_username: senderUsername,
            participant_profile_pic: senderPicUrl,
            snippet: messageText.substring(0, 100),
            last_message_at: sentAt,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'thread_id' })
        .select('id, unread_count')
        .single();

    if (convError || !conversation) {
        await logWebhook(supabase, 'ERROR', 'Erro ao criar/atualizar conversa', { error: convError?.message });
        return;
    }

    // 6. Incrementar contador de não lidas
    await supabase
        .from('instagram_conversations')
        .update({ unread_count: (conversation.unread_count || 0) + 1 })
        .eq('id', conversation.id);

    // 7. Inserir a mensagem (com organizacao_id para o filtro Realtime funcionar!)
    const { error: msgError } = await supabase
        .from('instagram_messages')
        .insert({
            organizacao_id: orgId,      // ← CRÍTICO para o Realtime filtrar por org
            conversation_id: conversation.id,
            message_id: messageId,
            from_id: senderIgId,
            from_name: senderName,
            content: messageText,
            message_type: messageObj?.attachments ? 'media' : 'text',
            direction: 'inbound',
            is_read: false,
            sent_at: sentAt,
        });

    if (msgError) {
        await logWebhook(supabase, 'ERROR', 'Erro ao salvar mensagem', { error: msgError.message });
        return;
    }

    await logWebhook(supabase, 'INFO',
        `✅ Mensagem de @${senderUsername || senderIgId} salva na Org ${orgId}`,
        { thread_id: threadId, message_id: messageId }
    );
}

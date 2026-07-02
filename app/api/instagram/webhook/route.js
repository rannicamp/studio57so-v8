// app/api/instagram/webhook/route.js
// Webhook para receber DMs do Instagram em tempo real via Meta Conversations API
// VERSÃO 3.0 — Suporte completo à Stella IA e Autopilot no Instagram Direct
import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Função de log centralizada (copiada do padrão WhatsApp)
async function logWebhook(supabase, level, message, payload = {}) {
  try {
    console.log(`[Instagram Webhook][${level}] ${message}`, JSON.stringify(payload).substring(0, 500));
  } catch (e) {
    // Silencioso
  }
}

// Busca a coluna ENTRADA do Funil de Entrada da organização
async function getOrgEntryColumnId(supabase, orgId) {
  const { data: funilSistema } = await supabase
    .from('funis')
    .select('id')
    .eq('organizacao_id', orgId)
    .eq('is_sistema', true)
    .maybeSingle();

  if (funilSistema) {
    const { data: coluna } = await supabase
      .from('colunas_funil')
      .select('id')
      .eq('funil_id', funilSistema.id)
      .eq('tipo_coluna', 'entrada')
      .maybeSingle();
    if (coluna) {
      return coluna.id;
    }
  }

  const { data: fallback } = await supabase
    .from('colunas_funil')
    .select('id')
    .eq('organizacao_id', orgId)
    .eq('tipo_coluna', 'entrada')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback) {
    return fallback.id;
  }

  return null;
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
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ status: 'ignored_empty_body' });
  }

  // Processa em background (não bloqueia a Meta)
  processWebhookPayload(supabase, body, request).catch(e => {
    console.error('[Instagram Webhook] Erro no processamento assíncrono:', e.message);
  });

  return NextResponse.json({ status: 'ok' });
}

// ─── PROCESSADOR PRINCIPAL ────────────────────────────────────────────────────
async function processWebhookPayload(supabase, body, request) {
  try {
    await logWebhook(supabase, 'INFO', 'Webhook recebido', { object: body.object });

    const entries = body.entry || [];
    for (const entry of entries) {
      await processEntry(supabase, entry, request);
    }
  } catch (error) {
    console.error('[Instagram Webhook] ERRO FATAL no processamento:', error.message);
  }
}

// ─── PROCESSADOR DE CADA ENTRY ────────────────────────────────────────────────
async function processEntry(supabase, entry, request) {
  const messagingEvents = entry.messaging || [];
  for (const event of messagingEvents) {
    await processMessagingEvent(supabase, event, entry.id, request);
  }

  const changes = entry.changes || [];
  for (const change of changes) {
    if (change.field === 'messages' || change.field === 'message_requests') {
      const value = change.value || {};
      if (value.messages) {
        for (const msg of value.messages) {
          await processGraphAPIMessage(supabase, msg, value, entry.id, request);
        }
      }
    }
  }
}

// ─── PROCESSADOR: FORMATO MESSAGING (CONVERSAS API) ──────────────────────────
async function processMessagingEvent(supabase, messaging, entryIgId, request) {
  const { sender, recipient, message, timestamp } = messaging;

  if (!message) return;

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
    request,
  });
}

// ─── PROCESSADOR: FORMATO GRAPH API (changes > messages) ─────────────────────
async function processGraphAPIMessage(supabase, msg, value, entryIgId, request) {
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
    return;
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
    request,
  });
}

// ─── NÚCLEO: SALVAR MENSAGEM NO BANCO E DISPARAR STELLA IA ───────────────────
async function saveInstaMessage(supabase, { senderIgId, recipientIgId, messageId, messageText, messageType = 'text', snippetText = null, timestamp, messageObj, request }) {
  // 1. Buscar a organização dona desta conta Instagram
  const { data: integracao } = await supabase
    .from('integracoes_meta')
    .select('id, organizacao_id, page_access_token, instagram_business_account_id')
    .eq('instagram_business_account_id', recipientIgId)
    .eq('is_active', true)
    .maybeSingle();

  if (!integracao) {
    const legacyIgAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    if (recipientIgId !== legacyIgAccountId) {
      await logWebhook(supabase, 'WARN', `Nenhuma integração para conta IG: ${recipientIgId}. Ignorando.`);
      return;
    }
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${senderIgId}?fields=name,username,profile_pic&access_token=${accessToken}`,
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
        }
      }
    } catch (e) {
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
      snippet: (snippetText || messageText || '').substring(0, 100),
      last_message_at: sentAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'thread_id' })
    .select('id, unread_count, contato_id')
    .single();

  if (convError || !conversation) {
    await logWebhook(supabase, 'ERROR', 'Erro ao criar/atualizar conversa', { error: convError?.message });
    return;
  }

  // 6. Criar contato e card no funil de forma automática (se for um lead novo sem correspondência)
  let contatoIdFinal = conversation.contato_id;

  if (!contatoIdFinal && orgId) {
    try {
      console.log(`[Instagram Webhook] Nova conversa detectada. Criando lead no CRM...`);

      // A. Buscar o ID do contato da Stella IA da organização
      let stellaContatoId = null;
      const { data: stellaUser } = await supabase
        .from('usuarios')
        .select('contato_id')
        .eq('email', `stella.org${orgId}@elo57.com.br`)
        .maybeSingle();
      
      if (stellaUser?.contato_id) {
        stellaContatoId = stellaUser.contato_id;
      }

      // B. Criar o contato do lead no CRM (Stella ativa)
      const { data: newContact, error: contactError } = await supabase
        .from('contatos')
        .insert({
          nome: senderName || (senderUsername ? `@${senderUsername}` : 'Lead Instagram'),
          origem: 'Instagram Direct',
          tipo_contato: 'Lead',
          personalidade_juridica: 'Pessoa Fisica',
          organizacao_id: orgId,
          ia_atendimento_ativo: true, // Começa sob o piloto automático
          foto_url: senderPicUrl || null
        })
        .select('id')
        .single();

      if (contactError || !newContact) {
        console.error('[Instagram Webhook] Erro ao criar contato para lead Instagram:', contactError?.message);
      } else {
        contatoIdFinal = newContact.id;
        console.log(`[Instagram Webhook] Contato criado no CRM com ID: ${contatoIdFinal}`);

        // C. Buscar a coluna de entrada
        const colunaEntradaId = await getOrgEntryColumnId(supabase, orgId);

        if (colunaEntradaId) {
          // D. Criar o card no funil apontando para a Stella IA
          const { data: cardFunil, error: cardError } = await supabase
            .from('contatos_no_funil')
            .insert({
              contato_id: contatoIdFinal,
              coluna_id: colunaEntradaId,
              organizacao_id: orgId,
              corretor_id: stellaContatoId // Stella IA responsável inicialmente
            })
            .select('id')
            .single();

          if (cardError || !cardFunil) {
            console.error('[Instagram Webhook] Erro ao vincular lead ao funil comercial:', cardError?.message);
          } else {
            console.log(`[Instagram Webhook] Card do lead criado no funil com ID: ${cardFunil.id}`);

            // E. Registrar nota documentando a entrada
            await supabase.from('crm_notas').insert({
              contato_id: contatoIdFinal,
              contato_no_funil_id: cardFunil.id,
              conteudo: `🤖 [Piloto Automático Stella] Lead iniciou conversa direta por DM no Instagram. Stella IA assumiu a responsabilidade pelo atendimento.`,
              organizacao_id: orgId
            });
          }
        }

        // F. Vincular o contato à conversa do Instagram
        await supabase
          .from('instagram_conversations')
          .update({ contato_id: contatoIdFinal })
          .eq('id', conversation.id);
      }
    } catch (createErr) {
      console.error('[Instagram Webhook] Falha ao provisionar contato e funil:', createErr.message);
    }
  }

  // 7. Incrementar contador de não lidas
  await supabase
    .from('instagram_conversations')
    .update({ unread_count: (conversation.unread_count || 0) + 1 })
    .eq('id', conversation.id);

  // 8. Inserir a mensagem
  const { error: msgError } = await supabase
    .from('instagram_messages')
    .insert({
      organizacao_id: orgId,
      conversation_id: conversation.id,
      message_id: messageId,
      from_id: senderIgId,
      from_name: senderName,
      content: messageText,
      message_type: messageType,
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

  // 9. PILOTO AUTOMÁTICO (STELLA IA)
  let isAutopilotActive = false;
  let stellaUserId = null;

  if (contatoIdFinal && orgId) {
    try {
      const [contatoRes, stellaUserRes, funilRes] = await Promise.all([
        supabase
          .from('contatos')
          .select('ia_atendimento_ativo')
          .eq('id', contatoIdFinal)
          .single(),
        supabase
          .from('usuarios')
          .select('id, contato_id')
          .eq('email', `stella.org${orgId}@elo57.com.br`)
          .maybeSingle(),
        supabase
          .from('contatos_no_funil')
          .select('corretor_id')
          .eq('contato_id', contatoIdFinal)
          .limit(1)
      ]);

      isAutopilotActive = !!contatoRes.data?.ia_atendimento_ativo;

      // Verificar se a organização possui acesso à Inteligência Artificial no plano dela
      let hasAiAccess = false;
      try {
        const { data: org } = await supabase
          .from('organizacoes')
          .select('plano_codigo, planos ( modulos_inclusos )')
          .eq('id', orgId)
          .single();

        if (org) {
          if (orgId === 1) {
            hasAiAccess = true;
          } else {
            const planoCodigo = org.plano_codigo || 'essencial';
            const modulos = org.planos?.modulos_inclusos || {};
            const fallbackModulos = {
              essencial: { inteligencia_artificial: false },
              pro: { inteligencia_artificial: false },
              ia: { inteligencia_artificial: true }
            };
            hasAiAccess = modulos.inteligencia_artificial === true || fallbackModulos[planoCodigo]?.inteligencia_artificial === true;
          }
        }
      } catch (errPlan) {
        console.error(`[Instagram Webhook Plan Check Error]:`, errPlan.message);
      }

      if (!hasAiAccess) {
        isAutopilotActive = false;
        if (contatoRes.data?.ia_atendimento_ativo) {
          await supabase
            .from('contatos')
            .update({ ia_atendimento_ativo: false })
            .eq('id', contatoIdFinal);
        }
      }
      stellaUserId = stellaUserRes.data?.id;
      const stellaContatoId = stellaUserRes.data?.contato_id;
      const leadCorretorId = funilRes.data?.[0]?.corretor_id;

      if (isAutopilotActive) {
        // Se o lead no funil foi reatribuído a um corretor humano, desativa o autopilot
        if (stellaContatoId && leadCorretorId && stellaContatoId !== leadCorretorId) {
          console.log(`[Instagram Webhook] Lead ${contatoIdFinal} sob responsabilidade de corretor humano (${leadCorretorId}). Desativando autopilot.`);
          isAutopilotActive = false;
          await supabase
            .from('contatos')
            .update({ ia_atendimento_ativo: false })
            .eq('id', contatoIdFinal);
        }
      }
    } catch (err) {
      console.error('[Instagram Webhook] Erro ao validar ia_atendimento_ativo:', err);
    }
  }

  // 10. ACIONAR AUTOPILOT DE FORMA ASSÍNCRONA (after)
  if (isAutopilotActive && contatoIdFinal && request) {
    after(async () => {
      console.log(`[Instagram Autopilot] Aguardando 4 segundos de debounce para o contato ${contatoIdFinal}...`);
      await new Promise(resolve => setTimeout(resolve, 4000));

      try {
        // Verifica se houve mensagens inbound mais recentes do mesmo remetente
        const { data: msgAtualRecord } = await supabase
          .from('instagram_messages')
          .select('created_at')
          .eq('message_id', messageId)
          .maybeSingle();

        if (msgAtualRecord) {
          const { data: msgPosterior } = await supabase
            .from('instagram_messages')
            .select('id')
            .eq('conversation_id', conversation.id)
            .gt('created_at', msgAtualRecord.created_at)
            .eq('direction', 'inbound')
            .limit(1)
            .maybeSingle();

          if (msgPosterior) {
            console.log(`[Instagram Autopilot] Ignorando este disparo. Nova mensagem recebida durante o debounce.`);
            return;
          }
        }
      } catch (debounceErr) {
        console.warn('[Instagram Autopilot Warning] Falha no debounce:', debounceErr.message);
      }

      console.log(`[Instagram Autopilot] Acionando a Stella IA para o contato ${contatoIdFinal}...`);

      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host');

      if (host) {
        try {
          const apiUrl = `${protocol}://${host}/api/ai/chat-analysis`;
          
          const aiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              contato_id: contatoIdFinal, 
              organizacao_id: orgId, 
              canal: 'instagram',
              force: true,
              quickResponse: true
            })
          });

          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            
            if (aiResult?.proxima_resposta_sugerida) {
              const sendUrl = `${protocol}://${host}/api/instagram/send`;
              const fullText = aiResult.proxima_resposta_sugerida || '';
              
              let messagesParts = fullText
                .split(/\n\n+/)
                .map(part => part.trim())
                .filter(part => part.length > 0);

              // Reordena as pílulas para garantir o disclaimer no início e a pergunta no final
              messagesParts = reordenarPilulas(messagesParts);

              for (let i = 0; i < messagesParts.length; i++) {
                const partText = messagesParts[i];
                
                if (i > 0) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }

                console.log(`[Instagram Autopilot] Enviando pílula ${i + 1}/${messagesParts.length} via Instagram...`);
                await fetch(sendUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    organizacao_id: orgId,
                    conversation_id: conversation.id,
                    recipient_id: senderIgId,
                    text: partText
                  })
                });
              }

              // Envio do anexo como link no texto, se sugerido
              if (aiResult.anexo_sugerido && aiResult.anexo_sugerido.caminho_arquivo) {
                const anexo = aiResult.anexo_sugerido;
                const { data: urlData } = supabase.storage
                  .from('empreendimento-anexos')
                  .getPublicUrl(anexo.caminho_arquivo);
                
                if (urlData?.publicUrl) {
                  const textoLink = `Aqui está o link do material "${anexo.nome_arquivo}" para você visualizar:\n${urlData.publicUrl}`;
                  
                  await fetch(sendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organizacao_id: orgId,
                      conversation_id: conversation.id,
                      recipient_id: senderIgId,
                      text: textoLink
                    })
                  });

                  if (anexo.pergunta_pos_anexo) {
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    await fetch(sendUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        organizacao_id: orgId,
                        conversation_id: conversation.id,
                        recipient_id: senderIgId,
                        text: anexo.pergunta_pos_anexo
                      })
                    });
                  }
                }
              }
            }
          }
        } catch (apiErr) {
          console.error('[Instagram Autopilot Error] Falha na chamada de API comercial:', apiErr.message);
        }
      }
    });
  }
}

// HEURÍSTICA DE OURO: Garante disclaimer no início e pergunta de engajamento no final das pílulas
function reordenarPilulas(messagesParts) {
  if (!Array.isArray(messagesParts) || messagesParts.length <= 1) {
    return messagesParts;
  }

  // 1. Identificar e remover o disclaimer para a primeira posição
  const disclaimerIdx = messagesParts.findIndex(part => {
    const p = part.toLowerCase();
    return p.includes('sou a stella') || (p.includes('inteligência artificial') && p.includes('corretor humano'));
  });

  let disclaimer = null;
  if (disclaimerIdx > -1) {
    disclaimer = messagesParts.splice(disclaimerIdx, 1)[0];
  }

  // 2. Identificar a pílula de pergunta de engajamento (contém "?" nos últimos 15 caracteres e não é uma saudação curta)
  const perguntaIdx = messagesParts.findIndex(part => {
    const p = part.trim();
    const pLower = p.toLowerCase();
    
    if (pLower.includes('tudo bem?') || pLower.includes('como vai?') || pLower.includes('tudo joia?') || pLower.includes('como você está?') || pLower.includes('como voce esta?')) {
      if (p.length < 35) return false; // Se for uma frase curta de saudação, ignora
    }
    
    // Verificar se existe "?" nos últimos 15 caracteres da pílula
    const finalStr = p.slice(-15);
    return finalStr.includes('?');
  });

  let pergunta = null;
  if (perguntaIdx > -1) {
    pergunta = messagesParts.splice(perguntaIdx, 1)[0];
  }

  // Reagrupar: disclaimer no início, pergunta no final
  if (disclaimer) {
    messagesParts.unshift(disclaimer);
  }
  if (pergunta) {
    messagesParts.push(pergunta);
  }

  return messagesParts;
}

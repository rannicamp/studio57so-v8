// app/api/whatsapp/webhook/route.js
import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANTE: Importando os serviços novos
import { logWebhook } from './services/helpers';
import { findOrCreateContactAndConversation } from './services/crm';
import { handleMessageInsert, handleReaction } from './services/message';

// Configuração do Supabase Admin
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// --- ROTA GET (Verificação do Token no cadastro da Meta) ---
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const supabaseAdmin = getSupabaseAdmin();

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe') {
    if (token === process.env.META_VERIFY_TOKEN || token === process.env.WHATSAPP_VERIFY_TOKEN) {
      try { await logWebhook(supabaseAdmin, 'INFO', 'Webhook Verificado com Sucesso pelo Painel Meta!', { token_usado: token }); } catch (e) { }
      return new NextResponse(challenge, { status: 200 });
    } else {
      try { await logWebhook(supabaseAdmin, 'ERROR', 'Falha de Verificação de Webhook (Token Incorreto)', { token_enviado: token, token_esperado: process.env.META_VERIFY_TOKEN }); } catch (e) { }
      return new NextResponse('Token Incorreto', { status: 403 });
    }
  }

  return new NextResponse('Bad Request', { status: 400 });
}

// --- ROTA POST (O Coração do Webhook) ---
export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();

    try { await logWebhook(supabaseAdmin, 'INFO', 'Webhook Bateu na Porta', { body }); } catch (e) { }

    const change = body.entry?.[0]?.changes?.[0]?.value;
    if (!change) return NextResponse.json({ status: 'ignored_empty' });

    const phoneNumberId = change.metadata?.phone_number_id;

    if (!phoneNumberId) {
      console.warn('[Webhook] Recebeu payload sem phone_number_id');
      return NextResponse.json({ status: 'ignored_no_phone_id' });
    }

    // 1. Validar Configuração
    const { data: config } = await supabaseAdmin
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .limit(1)
      .maybeSingle();

    if (!config) {
      console.error(`[Webhook] ERRO: Configuração não encontrada para o número receptor: ${phoneNumberId}`);
      return NextResponse.json({ error: 'Configuração não encontrada para este número' }, { status: 404 });
    }

    // 2. Rota de Status
    if (change.statuses) {
      const statusUpdate = change.statuses[0];
      let errorMessage = null;
      if (statusUpdate.status === 'failed' && statusUpdate.errors && statusUpdate.errors.length > 0) {
        errorMessage = `Meta Error ${statusUpdate.errors[0].code}: ${statusUpdate.errors[0].message || statusUpdate.errors[0].title || 'Failed'}`;
      }

      const updatePayload = { status: statusUpdate.status };
      if (errorMessage) {
        updatePayload.error_message = errorMessage;
      }

      const { data: updatedMsg } = await supabaseAdmin.from('whatsapp_messages')
        .update(updatePayload)
        .eq('message_id', statusUpdate.id)
        .select('contato_id, organizacao_id')
        .maybeSingle();

      if (statusUpdate.status === 'failed' && updatedMsg) {
        const { contato_id, organizacao_id } = updatedMsg;
        console.log(`[Webhook Status] Detetada falha de envio para o contato ${contato_id} na org ${organizacao_id}. Erro: ${errorMessage}`);
        
        try {
          await supabaseAdmin.from('contatos')
            .update({ ia_atendimento_ativo: false })
            .eq('id', contato_id);

          const { data: funil } = await supabaseAdmin.from('contatos_no_funil')
            .select('id, coluna_id')
            .eq('contato_id', contato_id)
            .limit(1);

          const funilRecord = funil?.[0];
          const colunaFalhasId = '2b975bc0-b96c-456d-ac30-48ab6f6dddca'; // Coluna FALHAS

          if (funilRecord && funilRecord.coluna_id !== colunaFalhasId) {
            await supabaseAdmin.from('contatos_no_funil')
              .update({ coluna_id: colunaFalhasId, updated_at: new Date().toISOString() })
              .eq('id', funilRecord.id);

            const erroFormatado = errorMessage || 'Erro desconhecido no envio da Meta';
            await supabaseAdmin.from('crm_notas')
              .insert({
                contato_id: contato_id,
                contato_no_funil_id: funilRecord.id,
                conteudo: `🤖 [Piloto Automático Stella] Envio de mensagem falhou no WhatsApp (Erro: ${erroFormatado}). Lead movido automaticamente para a coluna FALHAS e piloto automático desativado.`,
                organizacao_id: organizacao_id
              });
            
            console.log(`[Webhook Status] Lead ${contato_id} movido com sucesso para a coluna FALHAS por erro de entrega.`);
          }
        } catch (errHook) {
          console.error('[Webhook Status Error] Erro ao tratar falha de envio no funil:', errHook.message);
        }
      }

      return NextResponse.json({ status: 'status_updated' });
    }

    // 3. Rota de Mensagens e Reações
    const message = change.messages?.[0];
    if (message) {
      console.log(`[Webhook] Recebido tipo: ${message.type} para Org ${config.organizacao_id}`);

      if (message.type === 'reaction') {
        await handleReaction(supabaseAdmin, message.reaction, message.from, config);
        return NextResponse.json({ status: 'reaction_processed' });
      }

      // A. Garante que contato e conversa existem
      const { contatoId, conversationRecordId } = await findOrCreateContactAndConversation(supabaseAdmin, message, config);

      // B. Verifica duplicidade
      const { data: existing } = await supabaseAdmin.from('whatsapp_messages').select('id').eq('message_id', message.id).maybeSingle();
      if (existing) return NextResponse.json({ status: 'ignored_duplicate' });

      // C. Insere a mensagem
      await handleMessageInsert(supabaseAdmin, message, config, contatoId, conversationRecordId);

      await logWebhook(supabaseAdmin, 'INFO', `Msg recebida: ${message.type}`, { from: message.from, org_id: config.organizacao_id });

      // D. PILOTO AUTOMÁTICO (STELLA)
      let isAutopilotActive = false;
      let stellaUserId = null;
      try {
        const { data: contato } = await supabaseAdmin
          .from('contatos')
          .select('ia_atendimento_ativo, ai_analysis')
          .eq('id', contatoId)
          .single();
        isAutopilotActive = !!contato?.ia_atendimento_ativo;

        const cacheAiAnalysis = contato?.ai_analysis || {};
        if (cacheAiAnalysis.tentativas_insistencia && cacheAiAnalysis.tentativas_insistencia > 0) {
          console.log(`[Webhook] Cliente respondeu. Resetando tentativas_insistencia de ${cacheAiAnalysis.tentativas_insistencia} para 0 para Contato ${contatoId}.`);
          cacheAiAnalysis.tentativas_insistencia = 0;
          await supabaseAdmin
            .from('contatos')
            .update({ ai_analysis: cacheAiAnalysis })
            .eq('id', contatoId);
        }

        // Buscar o contato da Stella da organização e verificar se ela é a corretora responsável por este lead no funil
        // Mudamos funilRes para usar limit(1) e evitar erro de múltiplas linhas
        const [stellaUserRes, funilRes] = await Promise.all([
          supabaseAdmin
            .from('usuarios')
            .select('id, contato_id')
            .eq('email', `stella.org${config.organizacao_id}@elo57.com.br`)
            .maybeSingle(),
          supabaseAdmin
            .from('contatos_no_funil')
            .select('corretor_id')
            .eq('contato_id', contatoId)
            .limit(1)
        ]);

        stellaUserId = stellaUserRes.data?.id;
        const stellaContatoId = stellaUserRes.data?.contato_id;
        const leadCorretorId = funilRes.data?.[0]?.corretor_id;

        if (isAutopilotActive) {
          // Se o piloto automático está ativo, mas o lead no funil está atribuído a um corretor humano (não é Stella),
          // desliga o piloto automático por segurança.
          if (stellaContatoId && leadCorretorId && stellaContatoId !== leadCorretorId) {
            console.log(`[Webhook] Lead ${contatoId} está atribuído ao corretor ID ${leadCorretorId} (não é Stella). Desativando piloto automático.`);
            isAutopilotActive = false;
            await supabaseAdmin
              .from('contatos')
              .update({ ia_atendimento_ativo: false })
              .eq('id', contatoId);
          }
        }
      } catch (err) {
        console.error('[Webhook] Erro ao verificar ia_atendimento_ativo / atribuição Stella:', err);
      }

      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host');

      if (isAutopilotActive) {
        after(async () => {
          // --- DEBOUNCE CONTRA ENVIOS EM RAJADA PICADOS ---
          console.log(`[Autopilot Debounce] Aguardando 4 segundos para garantir que o cliente ${contatoId} não está digitando mensagens adicionais...`);
          await new Promise(resolve => setTimeout(resolve, 4000));

          try {
            const { data: msgAtualRecord } = await supabaseAdmin
              .from('whatsapp_messages')
              .select('created_at')
              .eq('message_id', message.id)
              .maybeSingle();

            if (msgAtualRecord) {
              const { data: msgPosterior } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id, created_at')
                .eq('contato_id', contatoId)
                .gt('created_at', msgAtualRecord.created_at)
                .eq('direction', 'inbound')
                .limit(1)
                .maybeSingle();

              if (msgPosterior) {
                console.log(`[Autopilot Debounce] Ignorando este disparo. O cliente enviou outra mensagem inbound mais recente durante o debounce de 4s.`);
                return;
              }
            }
          } catch (debounceErr) {
            console.error('[Autopilot Debounce Warning] Erro no fluxo de debounce:', debounceErr.message);
          }

          console.log(`[Autopilot] Contato ${contatoId} está com atendimento automático ATIVO. Acionando Stella de forma assíncrona...`);
          if (host) {
            try {
              const apiUrl = `${protocol}://${host}/api/ai/chat-analysis`;
              const isMedia = message.type === 'document' || message.type === 'image';
              const quickResponse = !isMedia;

              const aiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  contato_id: contatoId, 
                  organizacao_id: config.organizacao_id, 
                  force: true,
                  quickResponse: quickResponse
                })
              });
              
              if (aiResponse.ok) {
                const aiResult = await aiResponse.json();
                
                if (aiResult?.proxima_resposta_sugerida) {
                  const cleanPhone = (message.from || '').replace(/[^0-9]/g, '');
                  
                  if (cleanPhone) {
                    const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;
                    const fullText = aiResult.proxima_resposta_sugerida || '';
                    const messagesParts = fullText
                      .split(/\n\n+/)
                      .map(part => part.trim())
                      .filter(part => part.length > 0);

                    if (messagesParts.length === 0) {
                      messagesParts.push('Olá! Tudo bem?');
                    }

                    console.log(`[Autopilot] Dividindo mensagem em ${messagesParts.length} pílula(s) para o WhatsApp.`);

                    for (let i = 0; i < messagesParts.length; i++) {
                      const partText = messagesParts[i];
                      
                      if (i > 0) {
                        const delayMs = 2500;
                        console.log(`[Autopilot] Aguardando ${delayMs}ms antes de enviar a próxima pílula...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                      }

                      const sendTextResponse = await fetch(sendTextUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: cleanPhone,
                          type: 'text',
                          text: partText,
                          contact_id: contatoId,
                          organizacao_id: config.organizacao_id,
                          usuario_id: stellaUserId
                        })
                      });

                      if (sendTextResponse.ok) {
                        console.log(`[Autopilot] Pílula ${i + 1}/${messagesParts.length} enviada com sucesso!`);
                      } else {
                        const errText = await sendTextResponse.text();
                        console.error(`[Autopilot] Erro ao enviar pílula ${i + 1}/${messagesParts.length}:`, errText);
                      }
                    }
                    
                    if (aiResult.anexo_sugerido && aiResult.anexo_sugerido.caminho_arquivo) {
                      const anexo = aiResult.anexo_sugerido;
                      console.log(`[Autopilot] Stella sugeriu anexo exato "${anexo.nome_arquivo}". Disparando anexo automático...`);
                      
                      const { data: urlData } = supabaseAdmin.storage
                        .from('empreendimento-anexos')
                        .getPublicUrl(anexo.caminho_arquivo);
                        
                      if (urlData?.publicUrl) {
                        const ext = (anexo.nome_arquivo || '').split('.').pop().toLowerCase();
                        let mediaType = 'document';
                        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                          mediaType = 'image';
                        } else if (['mp4', 'mov', 'avi', 'mpeg'].includes(ext)) {
                          mediaType = 'video';
                        }
                        
                        const sendMediaResponse = await fetch(sendTextUrl, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            to: cleanPhone,
                            type: mediaType,
                            link: urlData.publicUrl,
                            filename: anexo.nome_arquivo,
                            caption: '',
                            contact_id: contatoId,
                            organizacao_id: config.organizacao_id,
                            usuario_id: stellaUserId
                          })
                        });
                        
                        const sendMediaResult = await sendMediaResponse.json();
                        
                        if (sendMediaResponse.ok) {
                          console.log('[Autopilot] Anexo enviado com sucesso!');
                          
                          const saveAttachmentUrl = `${protocol}://${host}/api/whatsapp/save-attachment`;
                          await fetch(saveAttachmentUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              contato_id: contatoId,
                              message_id: sendMediaResult.data?.messages?.[0]?.id,
                              storage_path: anexo.caminho_arquivo,
                              public_url: urlData.publicUrl,
                              file_name: anexo.nome_arquivo,
                              file_type: mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/pdf',
                              file_size: 0,
                              organizacao_id: config.organizacao_id
                            })
                          }).catch(e => console.error('[Autopilot] Erro ao salvar histórico de anexo:', e));
                        } else {
                          console.error('[Autopilot] Erro ao enviar mídia via API:', sendMediaResult.error);
                        }
                      }
                    }
                  }
                }
              } else {
                const errText = await aiResponse.text().catch(() => 'Erro desconhecido');
                console.error(`[Autopilot Error] Falha na API comercial chat-analysis (Status ${aiResponse.status}): ${errText}`);
                await executarTransbordoEmergencia(supabaseAdmin, contatoId, config, message.from, stellaUserId, protocol, host, `Status ${aiResponse.status} - ${errText}`);
              }
            } catch (autopilotErr) {
              console.error('[Autopilot Async Error] Falha de conexão ou erro no piloto automático:', autopilotErr);
              await executarTransbordoEmergencia(supabaseAdmin, contatoId, config, message.from, stellaUserId, protocol, host, autopilotErr.message);
            }
          }
        });
      } else {
        console.log(`[Webhook] Contato ${contatoId} com atendimento automático DESATIVADO. Disparando análise em background via after...`);
        after(async () => {
          try {
            if (host) {
              const apiUrl = `${protocol}://${host}/api/ai/chat-analysis`;
              const aiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contato_id: contatoId, organizacao_id: config.organizacao_id, force: true, quickResponse: false })
              });
              if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                console.error('[Webhook after] Erro na requisição de análise de IA:', errText);
              }
            }
          } catch (e) {
            console.error('[Webhook after Background Error]', e);
          }
        });
      }
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('[Webhook] Erro Fatal:', error);
    try { await logWebhook(supabaseAdmin, 'FATAL', 'Crash no Webhook', { error: error.message }); } catch (e) { }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


// --- FUNÇÃO DE EMERGÊNCIA: EVITA VÁCUO DE CLIENTE SE A IA FALHAR (DUNNING/GOOGLE 503) ---
async function executarTransbordoEmergencia(supabaseAdmin, contatoId, config, fromPhone, stellaUserId, protocol, host, motivoErro) {
  console.log(`[Autopilot Emergência] Executando transbordo de emergência para o contato ${contatoId}. Motivo: ${motivoErro}`);
  
  const cleanPhone = (fromPhone || '').replace(/[^0-9]/g, '');
  const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;
  
  // 1. Enviar mensagem de fallback
  const textoFallback = "Olá! Notei uma pequena oscilação temporária no meu sistema de dados agora. Para não te deixar esperando, já chamei um de nossos corretores para falar com você em instantes! Obrigado pela paciência. 🙏";
  
  try {
    const sendResponse = await fetch(sendTextUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: cleanPhone,
        type: 'text',
        text: textoFallback,
        contact_id: contatoId,
        organizacao_id: config.organizacao_id,
        usuario_id: stellaUserId
      })
    });
    
    if (sendResponse.ok) {
      console.log(`[Autopilot Emergência] Mensagem de fallback enviada para ${cleanPhone}.`);
    } else {
      const errText = await sendResponse.text();
      console.error(`[Autopilot Emergência Error] Falha ao enviar mensagem de fallback:`, errText);
    }
  } catch (errSend) {
    console.error(`[Autopilot Emergência Error] Erro de rede ao enviar fallback:`, errSend.message);
  }

  // 2. Mover lead para a coluna INTERVENÇÃO HUMANA (7de9b5b4-05fa-4813-82d8-7790406ee268)
  try {
    const { data: funil } = await supabaseAdmin
      .from('contatos_no_funil')
      .select('id')
      .eq('contato_id', contatoId)
      .limit(1);
      
    const funilRecord = funil?.[0];
    const colunaIntervencaoId = '7de9b5b4-05fa-4813-82d8-7790406ee268';
    
    if (funilRecord) {
      await supabaseAdmin
        .from('contatos_no_funil')
        .update({ coluna_id: colunaIntervencaoId, updated_at: new Date().toISOString() })
        .eq('id', funilRecord.id);
        
      console.log(`[Autopilot Emergência] Lead movido para a coluna INTERVENÇÃO HUMANA no funil.`);

      // 3. Gravar nota no CRM explicando a falha técnica
      await supabaseAdmin
        .from('crm_notas')
        .insert({
          contato_id: contatoId,
          contato_no_funil_id: funilRecord.id,
          conteudo: `🤖 [Autotransbordo Emergencial] O piloto automático Stella foi desligado temporariamente porque a API de IA do Gemini/Google retornou erro ou ficou indisponível (${motivoErro}). O lead foi encaminhado automaticamente para atendimento humano para evitar vácuo de resposta.`,
          usuario_id: stellaUserId || null,
          organizacao_id: config.organizacao_id
        });
        
      console.log(`[Autopilot Emergência] Nota de CRM registrada.`);
    }
  } catch (errDb) {
    console.error(`[Autopilot Emergência Error] Erro ao atualizar banco de dados:`, errDb.message);
  }

  // 4. Desativar piloto automático para o contato
  try {
    await supabaseAdmin
      .from('contatos')
      .update({ ia_atendimento_ativo: false })
      .eq('id', contatoId);
    console.log(`[Autopilot Emergência] Piloto automático desativado (ia_atendimento_ativo = false).`);
  } catch (errAtivo) {
    console.error(`[Autopilot Emergência Error] Erro ao desativar ia_atendimento_ativo:`, errAtivo.message);
  }
}

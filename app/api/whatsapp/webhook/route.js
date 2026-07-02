// app/api/whatsapp/webhook/route.js
import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// IMPORTANTE: Importando os serviços novos
import { logWebhook } from './services/helpers';
import { findOrCreateContactAndConversation } from './services/crm';
import { handleMessageInsert, handleReaction } from './services/message';
import { processarAnaliseStella } from '../../ai/chat-analysis/route';

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
      const profileName = change.contacts?.[0]?.profile?.name || null;
      const { contatoId, conversationRecordId } = await findOrCreateContactAndConversation(supabaseAdmin, message, config, profileName);

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

        // Verificar se a organização possui acesso à Inteligência Artificial no plano dela
        let hasAiAccess = false;
        try {
          const { data: org } = await supabaseAdmin
            .from('organizacoes')
            .select('plano_codigo, planos ( modulos_inclusos )')
            .eq('id', config.organizacao_id)
            .single();

          if (org) {
            if (config.organizacao_id === 1) {
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
          console.error('[Webhook Plan Check Error]:', errPlan.message);
        }

        if (hasAiAccess) {
          isAutopilotActive = !!contato?.ia_atendimento_ativo;
        } else {
          isAutopilotActive = false;
          if (contato?.ia_atendimento_ativo) {
            console.log(`[Webhook Plan Enforcer] Desativando Stella para Contato ${contatoId} da Org ${config.organizacao_id} por falta de módulo de IA.`);
            await supabaseAdmin
              .from('contatos')
              .update({ ia_atendimento_ativo: false })
              .eq('id', contatoId);
          }
        }

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
            .select('id, corretor_id, coluna_id')
            .eq('contato_id', contatoId)
            .limit(1)
        ]);

        stellaUserId = stellaUserRes.data?.id;
        const stellaContatoId = stellaUserRes.data?.contato_id;
        const leadCorretorId = funilRes.data?.[0]?.corretor_id;
        const leadColunaId = funilRes.data?.[0]?.coluna_id;
        const funilRecordId = funilRes.data?.[0]?.id;

        // --- AUTO-RECUPERAÇÃO DE LEADS COM FALHAS DE ENTREGA OU SILENCIADOS ---
        const colunaFalhasId = '2b975bc0-b96c-456d-ac30-48ab6f6dddca';
        const colunaEmAtendimentoId = '029c8d6a-4799-4f4b-a55e-b4d5426718c0';

        if (!isAutopilotActive) {
          const ehColunaFalhas = leadColunaId === colunaFalhasId;
          const semCorretorOuEhStella = !leadCorretorId || (stellaContatoId && leadCorretorId === stellaContatoId);

          if (ehColunaFalhas || semCorretorOuEhStella) {
            console.log(`[Webhook Auto-recuperação] Cliente ${contatoId} respondeu voluntariamente. Reativando piloto automático e movendo para EM ATENDIMENTO.`);
            isAutopilotActive = true;
            
            // 1. Reativar autopilot no contato
            await supabaseAdmin
              .from('contatos')
              .update({ ia_atendimento_ativo: true })
              .eq('id', contatoId);

            // 2. Mover de volta para EM ATENDIMENTO se estiver na coluna de FALHAS
            if (funilRecordId && ehColunaFalhas) {
              await supabaseAdmin
                .from('contatos_no_funil')
                .update({ coluna_id: colunaEmAtendimentoId, updated_at: new Date().toISOString() })
                .eq('id', funilRecordId);

              // 3. Gravar nota no CRM
              await supabaseAdmin
                .from('crm_notas')
                .insert({
                  contato_id: contatoId,
                  contato_no_funil_id: funilRecordId,
                  conteudo: `🤖 [Auto-recuperação Stella] O lead respondeu ativamente ao WhatsApp. O piloto automático foi reativado com sucesso e o lead foi movido de volta para a coluna EM ATENDIMENTO.`,
                  organizacao_id: config.organizacao_id,
                  usuario_id: stellaUserId
                });
            }
          }
        }

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

      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host');

      if (isAutopilotActive) {
        console.log(`[Webhook Autopilot] Acionando processamento assíncrono em background para Contato ${contatoId}...`);
        
        after(async () => {
          const processUrl = `${protocol}://${host}/api/ai/stella/process`;
          try {
            const res = await fetch(processUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                record: {
                  id: message.id,
                  contato_id: contatoId,
                  organizacao_id: config.organizacao_id,
                  direction: 'inbound',
                  from: message.from
                }
              })
            });
            console.log(`[Webhook Autopilot] Disparo de processamento assíncrono finalizado com status: ${res.status}`);
          } catch (err) {
            console.error('[Webhook Autopilot Trigger Error] Erro ao invocar processamento assíncrono:', err.message);
          }
        });
      } else {
        // Se estiver desativado, atualizamos o cache em background para fins de análise histórica do CRM
        console.log(`[Webhook] Atendimento automático inativo para o contato ${contatoId}. Atualizando cache da análise...`);
        
        after(async () => {
          const processUrl = `${protocol}://${host}/api/ai/chat-analysis`;
          try {
            const res = await fetch(processUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contato_id: contatoId,
                organizacao_id: config.organizacao_id,
                force: true,
                quickResponse: false,
                canal: 'whatsapp'
              })
            });
            console.log(`[Webhook Cache] Disparo de atualização de cache finalizado com status: ${res.status}`);
          } catch (err) {
            console.error('[Webhook Cache Trigger Error] Erro ao invocar atualização de cache:', err.message);
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

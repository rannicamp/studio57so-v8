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

 // DICA: No cenário Multi-tenant, todos os seus clientes usarão o mesmo Verify Token // que você definir no App Principal da Meta (META_VERIFY_TOKEN).
 if (mode === 'subscribe') {
 if (token === process.env.META_VERIFY_TOKEN || token === process.env.WHATSAPP_VERIFY_TOKEN) {
 try { await logWebhook(supabaseAdmin, 'INFO', 'Webhook Verificado com Sucesso pelo Painel Meta!', { token_usado: token }); } catch (e) { }
 return new NextResponse(challenge, { status: 200 });
 } else {
 try { await logWebhook(supabaseAdmin, 'ERROR', 'Falha de Verificação de Webhook (Token Incorreto)', { token_enviado: token, token_esperado: process.env.META_VERIFY_TOKEN }); } catch (e) { }
 return new NextResponse('Token Incorreto', { status: 403 });
 }
 }

 // Alguém bateu no GET mas não enviou hub.mode try { await logWebhook(supabaseAdmin, 'WARNING', 'Batida GET no Webhook sem hub.mode', { url: request.url }); } catch (e) { }
 return new NextResponse('Bad Request', { status: 400 });
 }

// --- ROTA POST (O Coração do Webhook) ---
export async function POST(request) {
 const supabaseAdmin = getSupabaseAdmin();
 try {
 const body = await request.json();

 // Log bruto para pegar provas de que a Meta está pingando o servidor
 try { await logWebhook(supabaseAdmin, 'INFO', 'Webhook Bateu na Porta', { body }); } catch (e) { }

 const change = body.entry?.[0]?.changes?.[0]?.value;
 if (!change) return NextResponse.json({ status: 'ignored_empty' });

 // 🔥 A MÁGICA MULTI-TENANT ACONTECE AQUI!
 // A Meta nos informa qual é o ID do número que está RECENBENDO a mensagem
 const phoneNumberId = change.metadata?.phone_number_id;

 if (!phoneNumberId) {
 console.warn('[Webhook] Recebeu payload sem phone_number_id');
 return NextResponse.json({ status: 'ignored_no_phone_id' });
 }

 // 1. Validar Configuração (AGORA BLINDADA POR NÚMERO)
 const { data: config } = await supabaseAdmin
 .from('configuracoes_whatsapp')
 .select('*')
 .eq('whatsapp_phone_number_id', phoneNumberId) // <--- O CADEADO ESTÁ AQUI!
 .limit(1)
 .maybeSingle();

 if (!config) {
 console.error(`[Webhook] ERRO: Configuração não encontrada para o número receptor: ${phoneNumberId}`);
 return NextResponse.json({ error: 'Configuração não encontrada para este número' }, { status: 404 });
 }

  // 2. Rota de Status (Enviado, Entregue, Lido...)
  if (change.statuses) {
    const statusUpdate = change.statuses[0];
    // Corrige o Buraco Negro de Erros: Se a Meta rejeitar assincronamente (ex: falta de cartão),
    // ela não retorna erro HTTP 400. Ela retorna HTTP 200 no envio, mas joga 'failed' no webhook
    // com o array de errors. Temos que salvar esse erro!
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

    // Se falhou o envio de qualquer mensagem outbound, movemos o lead para a coluna FALHAS e desligamos a Stella
    if (statusUpdate.status === 'failed' && updatedMsg) {
      const { contato_id, organizacao_id } = updatedMsg;
      console.log(`[Webhook Status] Detetada falha de envio para o contato ${contato_id} na org ${organizacao_id}. Erro: ${errorMessage}`);
      
      try {
        // 1. Desliga o piloto automático da Stella por segurança (número inválido ou erro técnico grave)
        await supabaseAdmin.from('contatos')
          .update({ ia_atendimento_ativo: false })
          .eq('id', contato_id);

        // 2. Buscar se o lead está no funil comercial
        const { data: funil } = await supabaseAdmin.from('contatos_no_funil')
          .select('id, coluna_id')
          .eq('contato_id', contato_id)
          .maybeSingle();

        const colunaFalhasId = '2b975bc0-b96c-456d-ac30-48ab6f6dddca'; // Coluna FALHAS

        if (funil && funil.coluna_id !== colunaFalhasId) {
          // 3. Move o lead para a coluna FALHAS
          await supabaseAdmin.from('contatos_no_funil')
            .update({ coluna_id: colunaFalhasId, updated_at: new Date().toISOString() })
            .eq('id', funil.id);

          // 4. Cria a nota no CRM
          const erroFormatado = errorMessage || 'Erro desconhecido no envio da Meta';
          await supabaseAdmin.from('crm_notas')
            .insert({
              contato_id: contato_id,
              contato_no_funil_id: funil.id,
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

 // >>> AQUI ESTÁ A MÁGICA: SE FOR REAÇÃO, PARA TUDO E ATUALIZA <<<
 if (message.type === 'reaction') {
 // Passamos o config para garantir que ele salve atrelado à organização correta
 await handleReaction(supabaseAdmin, message.reaction, message.from, config);
 return NextResponse.json({ status: 'reaction_processed' });
 }

 // Se chegou aqui, é mensagem normal (texto, imagem, audio)

 // A. Garante que contato e conversa existem (passando a config blindada)
 const { contatoId, conversationRecordId } = await findOrCreateContactAndConversation(supabaseAdmin, message, config);

 // B. Verifica duplicidade
 const { data: existing } = await supabaseAdmin.from('whatsapp_messages').select('id').eq('message_id', message.id).maybeSingle();
 if (existing) return NextResponse.json({ status: 'ignored_duplicate' });

 // C. Insere a mensagem (já amarrada à config da organização)
 await handleMessageInsert(supabaseAdmin, message, config, contatoId, conversationRecordId);

 await logWebhook(supabaseAdmin, 'INFO', `Msg recebida: ${message.type}`, { from: message.from, org_id: config.organizacao_id });

   // D. PILOTO AUTOMÁTICO (STELLA)
   // Verificamos se o piloto automático está ativo para o contato ou se o lead está atribuído à Stella IA no funil comercial
   let isAutopilotActive = false;
   try {
      const { data: contato } = await supabaseAdmin
        .from('contatos')
        .select('ia_atendimento_ativo, ai_analysis')
        .eq('id', contatoId)
        .single();
      isAutopilotActive = !!contato?.ia_atendimento_ativo;

      // Zera o contador de tentativas de insistência pois o cliente respondeu (mensagem inbound)!
      const cacheAiAnalysis = contato?.ai_analysis || {};
      if (cacheAiAnalysis.tentativas_insistencia && cacheAiAnalysis.tentativas_insistencia > 0) {
        console.log(`[Webhook] Cliente respondeu. Resetando tentativas_insistencia de ${cacheAiAnalysis.tentativas_insistencia} para 0 para Contato ${contatoId}.`);
        cacheAiAnalysis.tentativas_insistencia = 0;
        await supabaseAdmin
          .from('contatos')
          .update({ ai_analysis: cacheAiAnalysis })
          .eq('id', contatoId);
      }

     if (!isAutopilotActive) {
       // Buscar o contato da Stella da organização e verificar se ela é a corretora responsável por este lead no funil
       const [stellaUserRes, funilRes] = await Promise.all([
         supabaseAdmin
           .from('usuarios')
           .select('contato_id')
           .eq('email', `stella.org${config.organizacao_id}@elo57.com.br`)
           .maybeSingle(),
         supabaseAdmin
           .from('contatos_no_funil')
           .select('corretor_id')
           .eq('contato_id', contatoId)
           .maybeSingle()
       ]);

       const stellaContatoId = stellaUserRes.data?.contato_id;
       const leadCorretorId = funilRes.data?.corretor_id;

       if (stellaContatoId && leadCorretorId && stellaContatoId === leadCorretorId) {
         console.log(`[Webhook] Lead ${contatoId} está atribuído à Stella IA no funil. Ativando piloto automático.`);
         isAutopilotActive = true;
         
         // Atualiza o banco de dados para ligar o piloto automático visualmente na ficha do CRM
         await supabaseAdmin
           .from('contatos')
           .update({ ia_atendimento_ativo: true })
           .eq('id', contatoId);
       }
     }
   } catch (err) {
     console.error('[Webhook] Erro ao verificar ia_atendimento_ativo / atribuição Stella:', err);
   }

  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host');

  if (isAutopilotActive) {
    // Agora o piloto automático também roda em background via Next.js after para evitar timeouts de 10s da Meta e da hospedagem (Netlify)
    after(async () => {
      // --- DEBOUNCE CONTRA ENVIOS EM RAJADA PICADOS (ESPERA DE SEGURANÇA DE 4 SEGUNDOS) ---
      console.log(`[Autopilot Debounce] Aguardando 4 segundos para garantir que o cliente ${contatoId} não está digitando mensagens adicionais...`);
      await new Promise(resolve => setTimeout(resolve, 4000));

      try {
        const { data: msgAtualRecord } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('created_at')
          .eq('message_id', message.id)
          .maybeSingle();

        if (msgAtualRecord) {
          // Busca se existe alguma mensagem inbound mais recente enviada pelo cliente depois da atual (durante a janela de 4s)
          const { data: msgPosterior } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('id, created_at')
            .eq('contato_id', contatoId)
            .gt('created_at', msgAtualRecord.created_at) // Estritamente posterior
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
          
          // Se a mensagem for de mídia (documento ou imagem), desativamos o quickResponse para enriquecimento completo.
          // Se for texto normal, ativamos o quickResponse para resposta rápida no WhatsApp.
          const isMedia = message.type === 'document' || message.type === 'image';
          const quickResponse = !isMedia;

          // Chamada síncrona para analisar e gerar a resposta da IA
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
                
                // 1. Enviar a mensagem de texto gerada
                const sendTextResponse = await fetch(sendTextUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: cleanPhone,
                    type: 'text',
                    text: aiResult.proxima_resposta_sugerida,
                    contact_id: contatoId,
                    organizacao_id: config.organizacao_id
                  })
                });
                
                if (sendTextResponse.ok) {
                  console.log('[Autopilot] Resposta de texto enviada com sucesso!');
                } else {
                  const errText = await sendTextResponse.text();
                  console.error('[Autopilot] Erro ao enviar resposta de texto:', errText);
                }
                
                // 2. Se houver anexo sugerido, enviar anexo automaticamente na sequência
                if (aiResult.anexo_sugerido && aiResult.anexo_sugerido.caminho_arquivo) {
                  const anexo = aiResult.anexo_sugerido;
                  console.log(`[Autopilot] Stella sugeriu anexo exato "${anexo.nome_arquivo}". Disparando anexo automático...`);
                  
                  // Obter URL pública do anexo
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
                        organizacao_id: config.organizacao_id
                      })
                    });
                    
                    const sendMediaResult = await sendMediaResponse.json();
                    
                    if (sendMediaResponse.ok) {
                      console.log('[Autopilot] Anexo enviado com sucesso!');
                      
                      // Salva no histórico de anexos do contato
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
            const errText = await aiResponse.text();
            console.error('[Autopilot] Erro na requisição de análise de IA:', errText);
          }
        } catch (autopilotErr) {
          console.error('[Autopilot Async Error]', autopilotErr);
        }
      }
    });
  } else {
    // Se o piloto automático não estiver ativo, mantemos o disparo de análise em background (Next.js after)
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
 // Tenta logar o erro, se possível
 try { await logWebhook(supabaseAdmin, 'FATAL', 'Crash no Webhook', { error: error.message }); } catch (e) { }

 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
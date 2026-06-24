// app/api/ai/stella/process/route.js
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processarAnaliseStella } from '../../chat-analysis/route';

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  let contatoId = null;
  let organizacaoId = null;
  let messageId = null;
  let messageFrom = null;

  try {
    const payload = await request.json();
    console.log('[Stella Background Process] Gatilho recebido:', JSON.stringify(payload, null, 2));

    const record = payload.record || payload;
    if (!record) {
      return NextResponse.json({ error: 'Payload inválido. Campo "record" não encontrado.' }, { status: 400 });
    }

    contatoId = record.contato_id;
    organizacaoId = record.organizacao_id;
    messageId = record.message_id || record.id;
    messageFrom = record.from || record.wa_id;

    if (!contatoId || !organizacaoId) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios do contato ou organização.' }, { status: 400 });
    }

    // 1. Buscar contato e a conversa vinculada em paralelo
    const [contatoRes, convRes] = await Promise.all([
      supabaseAdmin
        .from('contatos')
        .select('ia_atendimento_ativo, nome')
        .eq('id', contatoId)
        .single(),
      supabaseAdmin
        .from('whatsapp_conversations')
        .select('phone_number')
        .eq('contato_id', contatoId)
        .limit(1)
        .maybeSingle()
    ]);

    if (contatoRes.error) {
      console.error('[Stella Background Process Error] Erro ao carregar contato:', contatoRes.error.message);
      return NextResponse.json({ error: contatoRes.error.message }, { status: 500 });
    }

    const contato = contatoRes.data;
    const conversa = convRes.data;

    if (!contato || !contato.ia_atendimento_ativo) {
      console.log(`[Stella Background Process] Piloto automático INATIVO para o contato ${contatoId}. Ignorando.`);
      return NextResponse.json({ status: 'ignored_ia_inactive' });
    }

    // Obter número de telefone de forma segura
    let cleanPhone = messageFrom || conversa?.phone_number || '';
    cleanPhone = cleanPhone.replace(/[^0-9]/g, '');

    if (!cleanPhone) {
      console.error(`[Stella Background Process] Telefone não encontrado para o contato ${contatoId}.`);
      return NextResponse.json({ error: 'Telefone do contato inválido ou vazio.' }, { status: 400 });
    }

    // 2. DEBOUNCE CONTRA ENVIOS EM RAJADA PICADOS (4 segundos)
    console.log(`[Stella Background Process] Iniciando debounce de 4 segundos para contato ${contatoId}...`);
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Verifica se o cliente enviou outra mensagem inbound mais recente durante o debounce
    try {
      const { data: msgAtualRecord } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('created_at')
        .eq('message_id', messageId)
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
          console.log(`[Stella Background Process] Abortando processamento. Mensagem mais recente detectada durante o debounce.`);
          return NextResponse.json({ status: 'ignored_newer_message' });
        }
      }
    } catch (debounceErr) {
      console.error('[Stella Background Process] Erro no fluxo de debounce:', debounceErr.message);
    }

    // 3. Buscar configurações do WhatsApp para saber o ID do usuário Stella correspondente
    const { data: config } = await supabaseAdmin
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', organizacaoId)
      .limit(1)
      .maybeSingle();

    if (!config) {
      console.error(`[Stella Background Process] Configuração do WhatsApp não encontrada para a org ${organizacaoId}.`);
      return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada para a organização.' }, { status: 404 });
    }

    // Buscar o ID da Stella na public.usuarios
    const { data: stellaUserRes } = await supabaseAdmin
      .from('usuarios')
      .select('id, contato_id')
      .eq('email', `stella.org${organizacaoId}@elo57.com.br`)
      .maybeSingle();

    const stellaUserId = stellaUserRes?.id || null;
    const stellaContatoId = stellaUserRes?.contato_id || null;

    console.log(`[Stella Background Process] Executando chamada à IA para o contato ${contatoId}...`);
    
    // Roda a orquestração do Gemini
    const aiResult = await processarAnaliseStella({ 
      contato_id: contatoId, 
      organizacao_id: organizacaoId, 
      force: true,
      quickResponse: true,
      canal: 'whatsapp'
    });

    if (aiResult?._concorrencia_abortada) {
      console.log(`[Stella Background Process] Concorrência activa para o contato ${contatoId}. Abortando.`);
      return NextResponse.json({ status: 'concurrency_aborted' });
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');

    if (aiResult && !aiResult.error) {
      if (aiResult?.proxima_resposta_sugerida) {
        const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;

        const fullText = aiResult.proxima_resposta_sugerida || '';
        const messagesParts = fullText
          .split(/\n\n+/)
          .map(part => part.trim())
          .filter(part => part.length > 0);

        // Heurística de Ouro: Garante que o disclaimer de IA seja enviado em primeiro lugar
        const disclaimerIdx = messagesParts.findIndex(part => {
          const p = part.toLowerCase();
          return p.includes('sou a stella') || (p.includes('inteligência artificial') && p.includes('corretor humano'));
        });
        if (disclaimerIdx > -1) {
          const disclaimer = messagesParts.splice(disclaimerIdx, 1)[0];
          messagesParts.unshift(disclaimer);
          console.log(`[Stella Background Process] Disclaimer de IA detectado e reordenado para a primeira pílula.`);
        }

        if (messagesParts.length === 0) {
          messagesParts.push('Olá! Tudo bem?');
        }

        console.log(`[Stella Background Process] Enviando ${messagesParts.length} pílula(s) para o WhatsApp.`);

        for (let i = 0; i < messagesParts.length; i++) {
          const partText = messagesParts[i];
          
          if (i > 0) {
            const delayMs = 1500;
            console.log(`[Stella Background Process] Aguardando ${delayMs}ms antes da próxima pílula...`);
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
              organizacao_id: organizacaoId,
              usuario_id: stellaUserId
            })
          });

          if (sendTextResponse.ok) {
            console.log(`[Stella Background Process] Pílula ${i + 1}/${messagesParts.length} enviada.`);
          } else {
            const errText = await sendTextResponse.text();
            console.error(`[Stella Background Process] Erro pílula ${i + 1}/${messagesParts.length}:`, errText);
          }
        }

        // Envio do Anexo se sugerido pela Stella
        if (aiResult.anexo_sugerido && aiResult.anexo_sugerido.caminho_arquivo) {
          const anexo = aiResult.anexo_sugerido;
          console.log(`[Stella Background Process] Enviando anexo automático: "${anexo.nome_arquivo}"`);
          
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
                organizacao_id: organizacaoId,
                usuario_id: stellaUserId
              })
            });
            
            const sendMediaResult = await sendMediaResponse.json();
            
            if (sendMediaResponse.ok) {
              console.log('[Stella Background Process] Anexo enviado com sucesso.');
              
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
                  organizacao_id: organizacaoId
                })
              }).catch(e => console.error('[Stella Background Process] Erro ao salvar histórico de anexo:', e));

              // Envio da pergunta pós-anexo se ela existir
              if (anexo.pergunta_pos_anexo) {
                const delayPosAnexoMs = 1500;
                console.log(`[Stella Background Process] Aguardando ${delayPosAnexoMs}ms para pergunta pós-anexo...`);
                await new Promise(resolve => setTimeout(resolve, delayPosAnexoMs));
                
                await fetch(sendTextUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: cleanPhone,
                    type: 'text',
                    text: anexo.pergunta_pos_anexo,
                    contact_id: contatoId,
                    organizacao_id: organizacaoId,
                    usuario_id: stellaUserId
                  })
                });
                console.log('[Stella Background Process] Pergunta pós-anexo enviada.');
              }
            } else {
              console.error('[Stella Background Process] Erro ao enviar anexo:', sendMediaResult);
            }
          }
        }
      }
      return NextResponse.json({ status: 'success', analysis: aiResult });
    } else {
      const errReason = aiResult?.error || 'Erro na Stella IA';
      console.error('[Stella Background Process] Stella IA retornou erro:', errReason);
      
      // Aciona o transbordo emergencial
      await executarTransbordoEmergencia(supabaseAdmin, contatoId, config, cleanPhone, stellaUserId, protocol, host, errReason);
      return NextResponse.json({ error: errReason }, { status: 500 });
    }
  } catch (err) {
    console.error('[Stella Background Process Fatal Error]', err);
    // Aciona o transbordo emergencial
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    try {
      const configRes = await supabaseAdmin.from('configuracoes_whatsapp').select('*').eq('organizacao_id', organizacaoId).limit(1).maybeSingle();
      const userRes = await supabaseAdmin.from('usuarios').select('id').eq('email', `stella.org${organizacaoId}@elo57.com.br`).maybeSingle();
      const convRes = await supabaseAdmin.from('whatsapp_conversations').select('phone_number').eq('contato_id', contatoId).maybeSingle();
      
      await executarTransbordoEmergencia(
        supabaseAdmin,
        contatoId,
        configRes.data,
        convRes.data?.phone_number || messageFrom,
        userRes.data?.id || null,
        protocol,
        host,
        err.message
      );
    } catch (eFallback) {
      console.error('[Stella Background Process Fallback Critical Error] Falha ao executar transbordo emergencial:', eFallback.message);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// FUNÇÃO DE EMERGÊNCIA: EVITA VÁCUO DE CLIENTE SE A IA FALHAR
async function executarTransbordoEmergencia(supabaseAdmin, contatoId, config, fromPhone, stellaUserId, protocol, host, motivoErro) {
  console.log(`[Stella Background Process Autotransbordo] Executando emergência para o contato ${contatoId}. Motivo: ${motivoErro}`);
  
  if (!config) return;
  const cleanPhone = (fromPhone || '').replace(/[^0-9]/g, '');
  const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;
  
  // 1. Enviar mensagem de fallback
  const textoFallback = "Olá! Notei uma pequena oscilação temporária no meu sistema de dados agora. Para não te deixar esperando, já chamei um de nossos corretores para falar com você em instantes! Obrigado pela paciência. 🙏";
  
  try {
    await fetch(sendTextUrl, {
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
  } catch (errSend) {
    console.error(`[Stella Background Process Autotransbordo Error] Falha ao enviar mensagem de fallback:`, errSend.message);
  }

  // 2. Mover lead para a coluna INTERVENÇÃO HUMANA
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
    }
  } catch (errDb) {
    console.error(`[Stella Background Process Autotransbordo Error] Falha no CRM:`, errDb.message);
  }

  // 4. Desativar piloto automático para o contato
  try {
    await supabaseAdmin
      .from('contatos')
      .update({ ia_atendimento_ativo: false })
      .eq('id', contatoId);
  } catch (errAtivo) {
    console.error(`[Stella Background Process Autotransbordo Error] Falha ao desativar autopilot:`, errAtivo.message);
  }
}

// app/api/whatsapp/trigger-autopilot/route.js
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase Admin
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { contato_id, organizacao_id } = await request.json();
    
    if (!contato_id || !organizacao_id) {
      return NextResponse.json({ error: 'Parâmetros contato_id e organizacao_id são obrigatórios.' }, { status: 400 });
    }

    console.log(`[Trigger Autopilot] Iniciando checagem para o contato ${contato_id} na org ${organizacao_id}...`);

    // 1. Verificar se o piloto automático está ativo para o contato
    const { data: contato, error: contatoErr } = await supabaseAdmin
      .from('contatos')
      .select('ia_atendimento_ativo, nome')
      .eq('id', contato_id)
      .maybeSingle();

    if (contatoErr) {
      console.error(`[Trigger Autopilot] Erro ao buscar contato:`, contatoErr.message);
      return NextResponse.json({ error: contatoErr.message }, { status: 500 });
    }

    if (!contato?.ia_atendimento_ativo) {
      console.log(`[Trigger Autopilot] Piloto automático INATIVO para o contato ${contato_id}. Nenhuma ação necessária.`);
      return NextResponse.json({ status: 'ignored_autopilot_inactive' });
    }

    // 2. Buscar a Stella (usuário) na organização
    const { data: stellaUser, error: stellaErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, contato_id')
      .eq('email', `stella.org${organizacao_id}@elo57.com.br`)
      .maybeSingle();

    if (stellaErr || !stellaUser) {
      console.warn(`[Trigger Autopilot] Stella IA não encontrada para a org ${organizacao_id}.`);
      return NextResponse.json({ error: 'Stella não configurada para esta organização.' }, { status: 404 });
    }

    // 3. Verificar se o corretor atrelado no funil de vendas é de fato a Stella
    const { data: funil, error: funilErr } = await supabaseAdmin
      .from('contatos_no_funil')
      .select('corretor_id')
      .eq('contato_id', contato_id)
      .limit(1)
      .maybeSingle();

    if (funilErr) {
      console.error(`[Trigger Autopilot] Erro ao buscar lead no funil:`, funilErr.message);
      return NextResponse.json({ error: funilErr.message }, { status: 500 });
    }

    if (funil?.corretor_id && funil.corretor_id !== stellaUser.contato_id) {
      console.log(`[Trigger Autopilot] Lead está com o corretor ID ${funil.corretor_id} (Stella é ID ${stellaUser.contato_id}). Ignorando.`);
      return NextResponse.json({ status: 'ignored_not_stella_corretor' });
    }

    // 4. Buscar a última mensagem global e a última mensagem inbound
    const [msgGlobalRes, msgInboundRes] = await Promise.all([
      supabaseAdmin
        .from('whatsapp_messages')
        .select('id, content, direction, created_at, sender_id, status')
        .eq('contato_id', contato_id)
        .not('status', 'eq', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('whatsapp_messages')
        .select('created_at')
        .eq('contato_id', contato_id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (msgGlobalRes.error) {
      console.error(`[Trigger Autopilot] Erro ao buscar última mensagem:`, msgGlobalRes.error.message);
      return NextResponse.json({ error: msgGlobalRes.error.message }, { status: 500 });
    }

    const ultimaMsgGlobal = msgGlobalRes.data;
    const ultimaMsgInbound = msgInboundRes.data;

    // A janela de 24 horas está aberta se a última mensagem inbound foi recebida há menos de 24h
    const isJanelaAberta = ultimaMsgInbound && (new Date() - new Date(ultimaMsgInbound.created_at) < 24 * 60 * 60 * 1000);

    console.log(`[Trigger Autopilot] Contato ${contato_id}: Janela de 24h está ${isJanelaAberta ? 'ABERTA' : 'FECHADA'}.`);

    if (isJanelaAberta) {
      // Se a janela estiver aberta, mas a última mensagem geral foi outbound (nossa resposta), ignoramos
      if (ultimaMsgGlobal && ultimaMsgGlobal.direction !== 'inbound') {
        console.log(`[Trigger Autopilot] A última mensagem do contato ${contato_id} é outbound (já respondida dentro da janela aberta). Ignorando.`);
        return NextResponse.json({ status: 'ignored_already_replied' });
      }
    } else {
      // Se a janela estiver fechada, mas enviamos uma mensagem outbound nas últimas 12 horas,
      // ignoramos o trigger automático para evitar loops de templates recorrentes sem resposta do lead
      if (ultimaMsgGlobal && ultimaMsgGlobal.direction === 'outbound') {
        const tempoDesdeUltimoEnvio = new Date() - new Date(ultimaMsgGlobal.created_at);
        if (tempoDesdeUltimoEnvio < 12 * 60 * 60 * 1000) {
          console.log(`[Trigger Autopilot] Janela fechada, mas enviamos uma mensagem outbound há menos de 12 horas. Evitando spam. Ignorando.`);
          return NextResponse.json({ status: 'ignored_antispam_prevent' });
        }
      }
    }

    // 5. Buscar o telefone do contato para envio
    const { data: telData } = await supabaseAdmin
      .from('telefones')
      .select('telefone')
      .eq('contato_id', contato_id)
      .limit(1)
      .maybeSingle();

    const cleanPhone = telData?.telefone ? telData.telefone.replace(/[^0-9]/g, '') : null;
    if (!cleanPhone) {
      console.error(`[Trigger Autopilot] ERRO: Telefone não encontrado para o contato ${contato_id}`);
      return NextResponse.json({ error: 'Telefone do cliente não cadastrado.' }, { status: 404 });
    }

    // 6. Se a janela estiver fechada, buscar os templates de WhatsApp aprovados da Meta
    let templatesDisponiveis = [];
    if (!isJanelaAberta) {
      console.log(`[Trigger Autopilot] Buscando templates Meta da Org ${organizacao_id} para reengajamento...`);
      const { data: config } = await supabaseAdmin
        .from('configuracoes_whatsapp')
        .select('whatsapp_permanent_token, whatsapp_business_account_id')
        .eq('organizacao_id', organizacao_id)
        .limit(1)
        .single();

      if (config?.whatsapp_business_account_id) {
        const token = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
        const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?fields=name,status,category,language,components&limit=100`;
        try {
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const resJson = await res.json();
            templatesDisponiveis = (resJson.data || []).filter(t => t.status === 'APPROVED');
            console.log(`[Trigger Autopilot] Encontrados ${templatesDisponiveis.length} templates aprovados na Meta.`);
            
            if (templatesDisponiveis.length === 0) {
              await supabaseAdmin.from('app_logs').insert({
                origem: 'STELLA TEMPLATE WARNING',
                mensagem: `Nenhum template aprovado na Meta foi retornado para a Org ${organizacao_id}.`,
                payload: { site_response: resJson },
                organizacao_id: organizacao_id
              });
            }
          } else {
            const errText = await res.text();
            console.warn(`[Trigger Autopilot] Falha ao consultar templates da Meta. Status: ${res.status}`);
            await supabaseAdmin.from('app_logs').insert({
              origem: 'STELLA TEMPLATE ERROR',
              mensagem: `Erro ao consultar templates da Meta (Status ${res.status}) para a Org ${organizacao_id}.`,
              payload: { response: errText },
              organizacao_id: organizacao_id
            });
          }
        } catch (errTemplates) {
          console.error('[Trigger Autopilot] Erro ao buscar templates Meta:', errTemplates.message);
          await supabaseAdmin.from('app_logs').insert({
            origem: 'STELLA TEMPLATE ERROR',
            mensagem: `Erro de rede ao buscar templates Meta para a Org ${organizacao_id}: ${errTemplates.message}`,
            payload: { stack: errTemplates.stack },
            organizacao_id: organizacao_id
          });
        }
      }
    }

    // 7. Chamar a Stella (chat-analysis) para obter a resposta ou o template recomendado
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const apiUrl = `${protocol}://${host}/api/ai/chat-analysis`;

    console.log(`[Trigger Autopilot] Invocando chat-analysis (Janela Aberta: ${isJanelaAberta})...`);

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contato_id: contato_id,
        organizacao_id: organizacao_id,
        force: true,
        quickResponse: true,
        janelaFechada: !isJanelaAberta,
        templatesDisponiveis: templatesDisponiveis
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`Falha ao chamar chat-analysis: ${errText}`);
    }

    const aiResult = await aiResponse.json();

    const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;

    // 8. Se a IA sugerir o envio de um template (Janela Fechada)
    if (aiResult.template_selecionado && aiResult.template_selecionado !== 'null') {
      console.log(`[Trigger Autopilot] Stella sugeriu template "${aiResult.template_selecionado}". Enviando...`);

      // Tentar reconstruir o texto completo do template com as variáveis preenchidas para exibir no chat do CRM
      let resolvedTemplateText = `Template: ${aiResult.template_selecionado}`;
      try {
        const matchedTemp = (templatesDisponiveis || []).find(t => t.name === aiResult.template_selecionado);
        if (matchedTemp) {
          const bodyComponent = (matchedTemp.components || []).find(c => c.type === 'BODY' || c.type === 'body');
          if (bodyComponent && bodyComponent.text) {
            let textTemplate = bodyComponent.text;
            // Buscar parâmetros do body enviados pela IA em template_componentes
            const bodyParamsObj = (aiResult.template_componentes || []).find(c => (c.type || '').toLowerCase() === 'body');
            const parameters = bodyParamsObj?.parameters || [];

            // Substituir {{1}}, {{2}}, etc. pelos parâmetros correspondentes
            parameters.forEach((param, idx) => {
              const val = param.text || '';
              textTemplate = textTemplate.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
            });
            resolvedTemplateText = textTemplate;
          }
        }
      } catch (errResolve) {
        console.error('[Trigger Autopilot] Erro ao resolver texto do template:', errResolve.message);
      }

      const sendTemplateResponse = await fetch(sendTextUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanPhone,
          type: 'template',
          templateName: aiResult.template_selecionado,
          components: aiResult.template_componentes || [],
          custom_content: resolvedTemplateText,
          contact_id: contato_id,
          organizacao_id: organizacao_id,
          usuario_id: stellaUser.id
        })
      });

      if (!sendTemplateResponse.ok) {
        const errText = await sendTemplateResponse.text();
        console.error(`[Trigger Autopilot] Erro ao enviar template:`, errText);
        return NextResponse.json({ error: `Erro ao enviar template: ${errText}` }, { status: 500 });
      }

      return NextResponse.json({ status: 'success', sent_template: aiResult.template_selecionado });
    }

    // Se a janela estiver fechada, mas a IA não sugeriu nenhum template de reengajamento,
    // nós bloqueamos sumariamente o envio de texto livre para evitar falhas de entrega da Meta
    if (!isJanelaAberta) {
      console.warn(`[Trigger Autopilot Blocked] A janela está fechada e a IA não sugeriu nenhum template Meta. Abortando envio de texto livre para evitar erro de reengajamento.`);
      return NextResponse.json({ 
        error: 'Envio de texto livre bloqueado: janela de 24 horas está fechada e nenhum template foi sugerido pela IA.' 
      }, { status: 400 });
    }

    if (!aiResult?.proxima_resposta_sugerida) {
      console.log(`[Trigger Autopilot] Stella não retornou sugestão de resposta para o contato ${contato_id}.`);
      return NextResponse.json({ status: 'no_suggestion' });
    }

    // 9. Enviar a resposta gerada em pílulas pelo WhatsApp (Janela Aberta)
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
      console.log(`[Trigger Autopilot] Disclaimer de IA detectado e reordenado para a primeira pílula.`);
    }

    console.log(`[Trigger Autopilot] Enviando ${messagesParts.length} pílulas de resposta para ${cleanPhone}...`);

    for (let i = 0; i < messagesParts.length; i++) {
      const partText = messagesParts[i];
      if (i > 0) {
        // Debounce de 2.5s entre pílulas
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      const sendTextResponse = await fetch(sendTextUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanPhone,
          type: 'text',
          text: partText,
          contact_id: contato_id,
          organizacao_id: organizacao_id,
          usuario_id: stellaUser.id
        })
      });

      if (!sendTextResponse.ok) {
        const errText = await sendTextResponse.text();
        console.error(`[Trigger Autopilot] Erro ao enviar pílula ${i + 1}/${messagesParts.length}:`, errText);
      }
    }

    // 8. Enviar anexo sugerido se houver
    if (aiResult.anexo_sugerido && aiResult.anexo_sugerido.caminho_arquivo) {
      const anexo = aiResult.anexo_sugerido;
      console.log(`[Trigger Autopilot] Stella sugeriu anexo "${anexo.nome_arquivo}". Enviando...`);

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
            contact_id: contato_id,
            organizacao_id: organizacao_id,
            usuario_id: stellaUser.id
          })
        });

        if (sendMediaResponse.ok) {
          console.log(`[Trigger Autopilot] Anexo enviado com sucesso!`);
          
          if (anexo.pergunta_pos_anexo) {
            // Aguarda 3 segundos e envia a pergunta final pós-anexo
            await new Promise(resolve => setTimeout(resolve, 3000));
            await fetch(sendTextUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: cleanPhone,
                type: 'text',
                text: anexo.pergunta_pos_anexo,
                contact_id: contato_id,
                organizacao_id: organizacao_id,
                usuario_id: stellaUser.id
              })
            });
          }
        } else {
          const errText = await sendMediaResponse.text();
          console.error(`[Trigger Autopilot] Erro ao enviar anexo:`, errText);
        }
      }
    }

    return NextResponse.json({ status: 'success', sent_parts: messagesParts.length });

  } catch (err) {
    console.error(`[Trigger Autopilot Critical Error]`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// app/api/whatsapp/trigger-autopilot/route.js
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

    // 4. Buscar a última mensagem desse contato na tabela whatsapp_messages
    const { data: ultimaMsg, error: msgErr } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, content, direction, created_at, sender_id')
      .eq('contato_id', contato_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msgErr) {
      console.error(`[Trigger Autopilot] Erro ao buscar última mensagem:`, msgErr.message);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    if (!ultimaMsg) {
      console.log(`[Trigger Autopilot] Nenhuma mensagem encontrada no histórico para o contato ${contato_id}.`);
      return NextResponse.json({ status: 'ignored_no_history' });
    }

    // Se a última mensagem for OUTBOUND (ou seja, nós já respondemos), cancelamos
    if (ultimaMsg.direction !== 'inbound') {
      console.log(`[Trigger Autopilot] A última mensagem do contato ${contato_id} é outbound (já respondida). Ignorando.`);
      return NextResponse.json({ status: 'ignored_already_replied' });
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

    // 6. Chamar a Stella (chat-analysis) para obter a resposta recomendada
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const apiUrl = `${protocol}://${host}/api/ai/chat-analysis`;

    console.log(`[Trigger Autopilot] Última mensagem do contato é inbound e pendente: "${ultimaMsg.content}". Invocando Stella...`);

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contato_id: contato_id,
        organizacao_id: organizacao_id,
        force: true,
        quickResponse: true
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`Falha ao chamar chat-analysis: ${errText}`);
    }

    const aiResult = await aiResponse.json();
    if (!aiResult?.proxima_resposta_sugerida) {
      console.log(`[Trigger Autopilot] Stella não retornou sugestão de resposta para o contato ${contato_id}.`);
      return NextResponse.json({ status: 'no_suggestion' });
    }

    // 7. Enviar a resposta gerada em pílulas pelo WhatsApp
    const sendTextUrl = `${protocol}://${host}/api/whatsapp/send`;
    const fullText = aiResult.proxima_resposta_sugerida || '';
    const messagesParts = fullText
      .split(/\n\n+/)
      .map(part => part.trim())
      .filter(part => part.length > 0);

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

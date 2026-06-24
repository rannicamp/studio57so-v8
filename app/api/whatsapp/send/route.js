export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { formatarParaWhatsAppBR } from '@/utils/phoneUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();

    // Desestruturação dos dados recebidos
    let { 
      to, 
      type, 
      text, 
      link, 
      caption, 
      filename, 
      templateName, 
      languageCode, 
      components, 
      contact_id, 
      custom_content, 
      location, 
      organizacao_id, 
      usuario_id,
      bypass_autopilot
    } = body;

    // Trava de Segurança Básica
    if (!organizacao_id) {
      return NextResponse.json({ error: 'ID da organização não fornecido para o envio.' }, { status: 400 });
    }

    // Tenta obter o usuário logado a partir do cookie de sessão (caso a requisição venha do painel web)
    let requestUserId = usuario_id;
    if (!requestUserId) {
      try {
        const supabaseUser = await createServerClient();
        const { data: { user } } = await supabaseUser.auth.getUser();
        if (user) {
          requestUserId = user.id;
        }
      } catch (authErr) {
        console.warn('[WhatsApp Send Warning] Não foi possível obter o usuário logado via cookies:', authErr.message);
      }
    }

    // --- 1. LIMPEZA E VALIDAÇÃO DO TELEFONE ---
    const cleanPhone = formatarParaWhatsAppBR(to);

    if (!cleanPhone) {
      return NextResponse.json({ error: 'Número de telefone inválido ou vazio.' }, { status: 400 });
    }

    // --- 1.5 VALIDAÇÃO DE TAMANHO DE VÍDEO (Trava de 10MB) ---
    if (type === 'video' && link) {
      try {
        const headRes = await fetch(link, { method: 'HEAD' });
        const contentLength = headRes.headers.get('content-length');
        if (contentLength) {
          const sizeMb = parseInt(contentLength, 10) / (1024 * 1024);
          if (sizeMb > 10) {
            console.error(`[WhatsApp Send Error] Vídeo muito grande (${sizeMb.toFixed(2)}MB) bloqueado. Limite de 10MB.`);
            return NextResponse.json({ 
              error: `O WhatsApp não permite o envio de vídeos maiores que 10MB. Este vídeo possui ${sizeMb.toFixed(2)}MB.` 
            }, { status: 400 });
          }
        }
      } catch (headErr) {
        console.warn('[WhatsApp Send Warning] Não foi possível verificar o tamanho do vídeo via HEAD:', headErr.message);
      }
    }

    // --- 2. CONFIGURAÇÃO ---
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes_whatsapp')
      .select('*')
      .eq('organizacao_id', organizacao_id)
      .single();

    if (configError || !config) {
      return NextResponse.json({ error: 'Configuração do WhatsApp não encontrada para esta organização.' }, { status: 500 });
    }

    const token = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
    const phoneId = config.whatsapp_phone_number_id;

    // --- 2.5 RESOLUÇÃO DO CONTATO (Movido para antes do envio para a Meta API) ---
    let finalContactId = contact_id;
    if (!finalContactId) {
      try {
        const { data } = await supabaseAdmin.rpc('find_contact_smart', { phone_input: cleanPhone });
        finalContactId = data;
      } catch (e) {
        console.warn("Falha ao buscar contato por telefone:", e);
      }
    }

    // --- 2.6 TRAVA DO PILOTO AUTOMÁTICO (STELLA IA vs HUMANO) ---
    let contatoIaAtivo = false;
    if (finalContactId) {
      const { data: contatoInfo, error: contatoInfoErr } = await supabaseAdmin
        .from('contatos')
        .select('ia_atendimento_ativo')
        .eq('id', finalContactId)
        .single();
      
      if (!contatoInfoErr && contatoInfo) {
        contatoIaAtivo = !!contatoInfo.ia_atendimento_ativo;
      }
    }

    // Busca o ID de usuário da Stella IA desta organização
    let stellaUserId = null;
    try {
      const { data: stellaUser } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('email', `stella.org${organizacao_id}@elo57.com.br`)
        .maybeSingle();
      if (stellaUser) {
        stellaUserId = stellaUser.id;
      }
    } catch (stellaErr) {
      console.warn('[WhatsApp Send Warning] Erro ao buscar usuário da Stella:', stellaErr.message);
    }

    // Quem está enviando é um humano confirmed?
    // É humano se requestUserId existe e NÃO é o ID da Stella da organização
    const isHumanSending = requestUserId && requestUserId !== stellaUserId;

    if (!isHumanSending && !bypass_autopilot) {
      // Se NÃO for um humano confirmado (ou seja, é a Stella IA ou a requisição é sem identificação de usuário),
      // e o piloto automático do contato estiver desligado, bloqueia sumariamente!
      if (!contatoIaAtivo) {
        console.warn(`[WhatsApp Send Blocked] Envio automático bloqueado para Contato ID ${finalContactId}: Piloto automático está inativo (requestUserId: ${requestUserId || 'nulo'}).`);
        return NextResponse.json({ 
          error: 'Envio bloqueado: o piloto automático (Stella IA) está desativado para este contato.' 
        }, { status: 400 });
      }
    } else {
      // Se for um humano confirmado, e o piloto automático ainda constar como ativo no banco, desliga ele!
      if (contatoIaAtivo && finalContactId) {
        console.log(`[WhatsApp Send] Mensagem enviada manualmente pelo usuário humano ${requestUserId}. Desativando piloto automático para o contato ${finalContactId}.`);
        await supabaseAdmin
          .from('contatos')
          .update({ ia_atendimento_ativo: false })
          .eq('id', finalContactId);
      }
    }

    // --- 3. PREPARAÇÃO DO PAYLOAD PARA META ---
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: type
    };

    let messageContentForDb = '';

    if (type === 'text') {
      payload.text = { body: text, preview_url: true };
      messageContentForDb = text;
    }
    else if (type === 'template') {
      const cleanComponents = (components || []).filter(c => {
        const typeLower = (c.type || '').toLowerCase();
        // Remove componentes do tipo BUTTONS da Meta API de definição, pois a Meta Cloud API de envio os rejeita
        if (typeLower === 'buttons') return false;
        return true;
      });

      // Blindagem contra cabeçalhos do tipo IMAGE ausentes no payload para templates específicos conhecidos
      const temHeader = cleanComponents.some(c => (c.type || '').toLowerCase() === 'header');
      if (!temHeader) {
        if (templateName === 'beta_suites_1') {
          console.log(`[WhatsApp Send Blindagem] Injetando header IMAGE padrão para o template beta_suites_1`);
          cleanComponents.unshift({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944008469.png'
                }
              }
            ]
          });
        } else if (templateName === 'caixa_clientes_alfa') {
          console.log(`[WhatsApp Send Blindagem] Injetando header IMAGE padrão para o template caixa_clientes_alfa`);
          cleanComponents.unshift({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png'
                }
              }
            ]
          });
        } else if (templateName === 'apresentacao_imagem_') {
          console.log(`[WhatsApp Send Blindagem] Injetando header IMAGE padrão para o template apresentacao_imagem_`);
          cleanComponents.unshift({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG'
                }
              }
            ]
          });
        }
      }

      payload.template = {
        name: templateName,
        language: { code: languageCode || 'pt_BR' },
        components: cleanComponents
      };
      messageContentForDb = custom_content || `Template: ${templateName}`;
    }
    else if (type === 'image') {
      payload.image = { link: link, caption: caption || '' };
      messageContentForDb = caption || 'Imagem enviada';
    }
    else if (type === 'document') {
      payload.document = { link: link, caption: caption || '', filename: filename || 'documento.pdf' };
      messageContentForDb = caption || filename || 'Documento enviado';
    }
    else if (type === 'audio') {
      payload.audio = { link: link };
      messageContentForDb = 'Áudio enviado';
    }
    else if (type === 'video') {
      payload.video = { link: link, caption: caption || '' };
      messageContentForDb = caption || 'Vídeo enviado';
    }
    else if (type === 'location') {
      payload.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name || 'Localização',
        address: location.address || ''
      };
      messageContentForDb = `📍 Localização: ${location.latitude}, ${location.longitude}`;
    }

    console.log(`[WhatsApp Send] Enviando ${type} para ${cleanPhone}...`);

    // --- 4. TENTATIVA DE ENVIO (META API) ---
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    // --- 6. TRATAMENTO DE ERRO ---
    if (!response.ok) {
      console.error('[WhatsApp Send Error] Falha Meta:', JSON.stringify(responseData));

      const errorMessage = responseData.error?.message || 'Erro desconhecido na Meta API';
      const errorPayload = responseData;

      await supabaseAdmin.from('whatsapp_messages').insert({
        contato_id: finalContactId,
        sender_id: phoneId,
        receiver_id: cleanPhone,
        content: messageContentForDb,
        sent_at: new Date().toISOString(),
        direction: 'outbound',
        status: 'failed',
        raw_payload: errorPayload,
        error_message: errorMessage,
        organizacao_id: config.organizacao_id,
        media_url: link || null
      });

      return NextResponse.json({
        error: errorMessage,
        details: responseData
      }, { status: response.status });
    }

    // --- 7. CRIAÇÃO/ATUALIZAÇÃO DA CONVERSA (Prevenção inteligente de duplicidade de 9º dígito) ---
    let possibleConvPhones = [cleanPhone];
    if (cleanPhone.startsWith('55') && cleanPhone.length === 13 && cleanPhone[4] === '9') {
      possibleConvPhones.push('55' + cleanPhone.substring(2, 4) + cleanPhone.substring(5)); // Sem o 9
    } else if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
      possibleConvPhones.push('55' + cleanPhone.substring(2, 4) + '9' + cleanPhone.substring(4)); // Com o 9
    }

    let targetConvPhone = cleanPhone;
    try {
      const { data: existingConv } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('phone_number')
        .in('phone_number', possibleConvPhones)
        .eq('organizacao_id', config.organizacao_id)
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        targetConvPhone = existingConv.phone_number;
      }
    } catch (findConvErr) {
      console.warn('[WhatsApp Send Warning] Erro ao buscar conversa existente:', findConvErr.message);
    }

    const { data: conversationData, error: convError } = await supabaseAdmin
      .from('whatsapp_conversations')
      .upsert({
        phone_number: targetConvPhone,
        contato_id: finalContactId,
        organizacao_id: config.organizacao_id,
        updated_at: new Date().toISOString(),
        last_direction: 'outbound',
        last_status: 'sent'
      }, { onConflict: 'phone_number' })
      .select()
      .single();

    if (convError) console.error('[WhatsApp Send] Erro Upsert Conversation:', convError);

    const conversationRecordId = conversationData?.id;

    // --- 8. SUCESSO ---
    const newMessageId = responseData.messages?.[0]?.id;

    if (newMessageId) {
      const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert({
        contato_id: finalContactId,
        message_id: newMessageId,
        sender_id: phoneId,
        receiver_id: cleanPhone,
        content: messageContentForDb,
        sent_at: new Date().toISOString(),
        direction: 'outbound',
        status: 'sent',
        raw_payload: JSON.stringify(payload),
        organizacao_id: config.organizacao_id,
        conversation_record_id: conversationRecordId,
        media_url: link || null,
        error_message: null
      });

      if (dbError) console.error('[WhatsApp Send] Erro DB:', dbError);

      // --- 9. ATUALIZA ÚLTIMA MENSAGEM NA CONVERSA ---
      if (!dbError && conversationRecordId) {
        const { data: insertedMsg } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('id')
          .eq('message_id', newMessageId)
          .single();

        if (insertedMsg) {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({ last_message_id: insertedMsg.id })
            .eq('id', conversationRecordId);
        }
      }
    }

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('[WhatsApp Send Fatal Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
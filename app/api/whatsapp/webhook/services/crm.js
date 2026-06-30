import { logWebhook, getTextContent } from './helpers';
import { formatarParaWhatsAppBR } from '@/utils/phoneUtils';

export async function findOrCreateContactAndConversation(supabaseAdmin, message, config, profileName = null) {
  const rawFrom = message.from;
  const orgId = config.organizacao_id;
  let contatoId = null;
  let conversationRecordId = null;
  let contatoNome = profileName || `Lead (${rawFrom})`;

  // GARANTIA DE UNICIDADE DO 9º DÍGITO
  // Passamos isFromMeta = true pois a Meta sempre envia o número com DDI.
  const from = formatarParaWhatsAppBR(rawFrom, null, true);
  
  // --- MATCHMAKER DO 9º DÍGITO ---
  let possiblePhones = [from];
  if (from.startsWith('55') && from.length === 12) {
    possiblePhones.push('55' + from.substring(2, 4) + '9' + from.substring(4));
  } else if (from.startsWith('55') && from.length === 13 && from[4] === '9') {
    possiblePhones.push('55' + from.substring(2, 4) + from.substring(5));
  }

  // Adiciona a versão do phone_number bruto da Meta limpo e com "+"
  const cleanRawFrom = rawFrom.replace(/[^0-9]/g, '');
  if (!possiblePhones.includes(cleanRawFrom)) {
    possiblePhones.push(cleanRawFrom);
  }

  // Gera a lista expandida com e sem o "+" para compatibilidade com bases antigas
  const possiblePhonesExpanded = [];
  possiblePhones.forEach(phone => {
    if (!possiblePhonesExpanded.includes(phone)) {
      possiblePhonesExpanded.push(phone);
    }
    const withPlus = '+' + phone;
    if (!possiblePhonesExpanded.includes(withPlus)) {
      possiblePhonesExpanded.push(withPlus);
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!possiblePhonesExpanded.includes(cleanPhone)) {
      possiblePhonesExpanded.push(cleanPhone);
    }
  });

  // 1. Tentar achar o contato inteligentemente
  try {
    const { data } = await supabaseAdmin.rpc('find_contact_smart', { 
        phone_input: possiblePhones[0],
        v_org_id: orgId
    });
    contatoId = data;
    
    if (!contatoId && possiblePhones.length > 1) {
        const { data: data2 } = await supabaseAdmin.rpc('find_contact_smart', { 
            phone_input: possiblePhones[1],
            v_org_id: orgId
        });
        contatoId = data2;
    }
  } catch (error) {
    console.warn('[CRM] Erro ao buscar via RPC', error);
  }
  
  let existingConversation = null;

  // =========================================================================
  // TICKET: NOVO AGRUPAMENTO INTELIGENTE (Meta wa_id)
  // Busca a conversa usando primeiramente o ID oficial inquebrável da Meta.
  // =========================================================================
  const { data: conversaMeta } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, contato_id, phone_number, meta_wa_id')
    .eq('meta_wa_id', rawFrom)
    .eq('organizacao_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversaMeta) {
    existingConversation = conversaMeta;
    if (!contatoId) contatoId = conversaMeta.contato_id;
  }

  if (!existingConversation) {
    // Fallback: Busca na conversa existente pelo 9º dígito (útil no primeiro contato outbound)
    const { data: conversaExistente } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, contato_id, phone_number, meta_wa_id')
      .in('phone_number', possiblePhonesExpanded)
      .eq('organizacao_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversaExistente) {
      existingConversation = conversaExistente;
      if (!contatoId) contatoId = conversaExistente.contato_id;
    }
  }

  // 2. Se não achou, CRIA TUDO (Lead, Telefone, Funil)
  if (!contatoId) {
    console.log('[CRM] Criando novo Lead...');
    const insertPayload = {
      nome: contatoNome,
      tipo_contato: 'Lead',
      organizacao_id: orgId,
      is_awaiting_name_response: false
    };

    if (message.referral) {
      insertPayload.meta_referral_data = message.referral;
      if (message.referral.source_type === 'ad') {
        insertPayload.meta_ad_id = message.referral.source_id;
      }
    }

    const { data: newContact, error: createError } = await supabaseAdmin.from('contatos').insert(insertPayload).select().single();

    if (createError) throw new Error(`Erro criar contato: ${createError.message}`);

    contatoId = newContact.id;
    const cleanPhone = from.replace(/[^0-9]/g, '');

    // Cria telefone
    await supabaseAdmin.from('telefones').insert({
      contato_id: contatoId,
      telefone: cleanPhone,
      tipo: 'celular',
      organizacao_id: orgId
    });

    // =====================================================================
    // TICKET #56 — ROTEAMENTO INTELIGENTE DE LEADS
    // PASSO 1: Insere na entrada do funil padrão da organização
    // =====================================================================
    let contatoNoFunilId = null;
    const { data: funil } = await supabaseAdmin
      .from('funis')
      .select('id')
      .eq('organizacao_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (funil) {
      // Busca a coluna de tipo 'entrada' (ou a primeira coluna se não existir tipo específico)
      let col = null;
      const { data: colunaEntrada } = await supabaseAdmin
        .from('colunas_funil')
        .select('id')
        .eq('funil_id', funil.id)
        .eq('tipo_coluna', 'entrada')
        .limit(1)
        .maybeSingle();

      if (colunaEntrada) {
        col = colunaEntrada;
      } else {
        // Fallback: primeira coluna por ordem
        const { data: primeiraColuna } = await supabaseAdmin
          .from('colunas_funil')
          .select('id')
          .eq('funil_id', funil.id)
          .order('ordem')
          .limit(1)
          .maybeSingle();
        col = primeiraColuna;
      }

      if (col) {
        const { data: novoRegistroFunil, error: funilError } = await supabaseAdmin
          .from('contatos_no_funil')
          .insert({
            contato_id: contatoId,
            coluna_id: col.id,
            organizacao_id: orgId
          })
          .select('id')
          .single();

        if (!funilError && novoRegistroFunil?.id) {
          contatoNoFunilId = novoRegistroFunil.id;

          // =========================================================
          // PASSO 2: Consulta regras de automação e move se necessário
          // A RPC fn_rotear_lead verifica campanha/anúncio/página e
          // move o lead para o funil destino correto automaticamente.
          // =========================================================
          try {
            const { data: resultadoRoteamento } = await supabaseAdmin
              .rpc('fn_rotear_lead', { p_contato_no_funil_id: contatoNoFunilId });

            console.log(`[CRM] Roteamento: ${resultadoRoteamento}`);
          } catch (roteamentoError) {
            // Não lança erro — o lead já está no funil padrão como fallback
            console.warn('[CRM] Aviso: Falha no roteamento automático. Lead mantido no funil padrão.', roteamentoError?.message);
          }
        }
      }
    }
    
    // =========================================================================
    // GATILHO: SINCRONIZAÇÃO GOOGLE CONTACTS
    // Chama a API de sync para agrupar e enviar o Lead criado para as agendas
    // =========================================================================
    try {
      fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/google/sync-contatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contato_id: contatoId, organizacao_id: orgId })
      }).catch(err => console.error('[CRM] Erro silencioso ao chamar sync Google:', err));
    } catch(e) {}
    
  } else {
    // Se o contato existe e a mensagem traz dados de referral (Click-to-WhatsApp), atualiza a origem e o ad_id
    if (message.referral) {
      console.log('[CRM] Atualizando dados de referral no Lead existente...');
      const updatePayload = {
        meta_referral_data: message.referral
      };
      if (message.referral.source_type === 'ad') {
        updatePayload.meta_ad_id = message.referral.source_id;
      }
      await supabaseAdmin.from('contatos')
        .update(updatePayload)
        .eq('id', contatoId);
    }

    // Se já existe, verifica se estamos esperando o nome dele
    const { data: existing } = await supabaseAdmin.from('contatos').select('nome, is_awaiting_name_response').eq('id', contatoId).single();
    if (existing) {
      contatoNome = existing.nome;
      let textBody = getTextContent(message);
      // Lógica simples de atualização de nome
      if (textBody && existing.is_awaiting_name_response && textBody.length > 2 && message.type === 'text') {
        await supabaseAdmin.from('contatos').update({ nome: textBody, is_awaiting_name_response: false }).eq('id', contatoId);
        contatoNome = textBody;
      }
    }

    // GARANTIA DE CARD NO FUNIL: Se o contato já existe no sistema mas não tem card no funil desta org, nós o criamos
    try {
      const { data: cardExistente, error: cardError } = await supabaseAdmin
        .from('contatos_no_funil')
        .select('id')
        .eq('contato_id', contatoId)
        .eq('organizacao_id', orgId)
        .limit(1)
        .maybeSingle();

      if (!cardExistente && !cardError) {
        console.log(`[CRM] Contato existente ${contatoId} não possui card no funil. Criando card automático...`);
        const { data: funil } = await supabaseAdmin
          .from('funis')
          .select('id')
          .eq('organizacao_id', orgId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (funil) {
          let col = null;
          const { data: colunaEntrada } = await supabaseAdmin
            .from('colunas_funil')
            .select('id')
            .eq('funil_id', funil.id)
            .eq('tipo_coluna', 'entrada')
            .limit(1)
            .maybeSingle();

          if (colunaEntrada) {
            col = colunaEntrada;
          } else {
            const { data: primeiraColuna } = await supabaseAdmin
              .from('colunas_funil')
              .select('id')
              .eq('funil_id', funil.id)
              .order('ordem')
              .limit(1)
              .maybeSingle();
            col = primeiraColuna;
          }

          if (col) {
            const { data: novoRegistroFunil, error: funilError } = await supabaseAdmin
              .from('contatos_no_funil')
              .insert({
                contato_id: contatoId,
                coluna_id: col.id,
                organizacao_id: orgId
              })
              .select('id')
              .single();

            if (!funilError && novoRegistroFunil?.id) {
              console.log(`[CRM] Card criado com sucesso no funil (ID: ${novoRegistroFunil.id}) para contato existente.`);
              try {
                const { data: resultadoRoteamento } = await supabaseAdmin
                  .rpc('fn_rotear_lead', { p_contato_no_funil_id: novoRegistroFunil.id });
                console.log(`[CRM] Roteamento automático de card existente executado: ${resultadoRoteamento}`);
              } catch (roteamentoError) {
                console.warn('[CRM] Aviso: Falha no roteamento automático do card do contato existente.', roteamentoError?.message);
              }
            } else if (funilError) {
              console.error('[CRM] Erro ao inserir registro do card no funil:', funilError.message);
            }
          }
        }
      }
    } catch (errFunil) {
      console.error('[CRM] Erro crítico na verificação de card de contato existente:', errFunil.message);
    }
  }

  // =========================================================================
  // TICKET #58 — CRONÔMETRO DE JANELA 24H CORRETO
  // Só atualiza customer_window_start_at quando a mensagem é INBOUND (do cliente).
  // Mensagens outbound (da empresa) NÃO reiniciam o contador.
  // =========================================================================
  const isInbound = !message.from_me; // Mensagens do cliente não têm from_me === true
  const upsertData = {
    phone_number: from, // Usando 12 dígitos normalizado
    meta_wa_id: rawFrom, // O ID oficial e inquebrável da Meta
    updated_at: new Date().toISOString(),
    contato_id: contatoId,
    organizacao_id: orgId,
    ...(isInbound && { customer_window_start_at: new Date().toISOString() })
  };

  // 3. Garante que a Conversa existe (Auto-Heal Update ou Insert)
  if (existingConversation) {
    // Se a conversa existe, mas o phone_number difere da "fonte da verdade" (Meta), nós o atualizamos!
    await supabaseAdmin.from('whatsapp_conversations')
      .update(upsertData)
      .eq('id', existingConversation.id);
      
    conversationRecordId = existingConversation.id;
  } else {
    // Insere nova conversa
    const { data: conversationData } = await supabaseAdmin.from('whatsapp_conversations')
      .upsert(upsertData, { onConflict: 'phone_number', ignoreDuplicates: false })
      .select()
      .single();
      
    conversationRecordId = conversationData?.id;
  }

  return { contatoId, conversationRecordId };
}
import { logWebhook, getTextContent } from './helpers';
import { formatarParaWhatsAppBR } from '@/utils/phoneUtils';

export async function findOrCreateContactAndConversation(supabaseAdmin, message, config) {
 const rawFrom = message.from;
 const orgId = config.organizacao_id;
 let contatoId = null;
 let conversationRecordId = null;
 let contatoNome = `Lead (${rawFrom})`;

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
     .in('phone_number', possiblePhones)
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
 const { data: newContact, error: createError } = await supabaseAdmin.from('contatos').insert({
 nome: contatoNome,
 tipo_contato: 'Lead',
 organizacao_id: orgId,
 is_awaiting_name_response: false
 }).select().single();

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
 .order('criado_em', { ascending: true })
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
  }return { contatoId, conversationRecordId };
}
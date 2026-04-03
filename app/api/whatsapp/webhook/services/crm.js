// app/api/whatsapp/webhook/services/crm.js
import { logWebhook, getTextContent } from './helpers';

export async function findOrCreateContactAndConversation(supabaseAdmin, message, config) {
 const from = message.from;
 const orgId = config.organizacao_id;
 let contatoId = null;
 let conversationRecordId = null;
 let contatoNome = `Lead (${from})`;

 // 1. Tenta achar pelo telefone (últimos 8 dígitos para evitar erro de 9º dígito)
 const phoneSuffix = from.slice(-8);

 // Busca na tabela de telefones
 const { data: telefoneExistente } = await supabaseAdmin
 .from('telefones')
 .select('contato_id')
 .eq('organizacao_id', orgId)
 .ilike('telefone', `%${phoneSuffix}%`)
 .limit(1)
 .maybeSingle();

 if (telefoneExistente) {
 contatoId = telefoneExistente.contato_id;
 } else {
 // Fallback: Busca na conversa existente
 const { data: conversaExistente } = await supabaseAdmin
 .from('whatsapp_conversations')
 .select('contato_id')
 .eq('phone_number', from)
 .eq('organizacao_id', orgId)
 .maybeSingle();

 if (conversaExistente?.contato_id) {
 contatoId = conversaExistente.contato_id;
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
 phone_number: from,
 updated_at: new Date().toISOString(),
 contato_id: contatoId,
 organizacao_id: orgId,
 ...(isInbound && { customer_window_start_at: new Date().toISOString() })
 };

 // 3. Garante que a Conversa existe (Upsert)
 const { data: conversationData } = await supabaseAdmin.from('whatsapp_conversations')
 .upsert(upsertData, { onConflict: 'phone_number' })
 .select()
 .single();

 conversationRecordId = conversationData?.id;

 return { contatoId, conversationRecordId };
}
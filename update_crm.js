const fs = require('fs');
let content = fs.readFileSync('app/api/whatsapp/webhook/services/crm.js', 'utf8');

const replacement = `export async function findOrCreateContactAndConversation(supabaseAdmin, message, config) {
 const rawFrom = message.from;
 const orgId = config.organizacao_id;
 let contatoId = null;
 let conversationRecordId = null;
 let contatoNome = \`Lead (\${rawFrom})\`;

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

 if (!contatoId) {
   // Fallback: Busca na conversa existente
   const { data: conversaExistente } = await supabaseAdmin
   .from('whatsapp_conversations')
   .select('id, contato_id, phone_number')
   .in('phone_number', possiblePhones)
   .eq('organizacao_id', orgId)
   .order('updated_at', { ascending: false })
   .limit(1)
   .maybeSingle();

   if (conversaExistente?.contato_id) {
     contatoId = conversaExistente.contato_id;
     existingConversation = conversaExistente;
   }
 } else {
   // Achou contato. Vamos ver se tem conversa existente com alguma das variações
   const { data: conversaExistente } = await supabaseAdmin
   .from('whatsapp_conversations')
   .select('id, contato_id, phone_number')
   .in('phone_number', possiblePhones)
   .eq('organizacao_id', orgId)
   .order('updated_at', { ascending: false })
   .limit(1)
   .maybeSingle();
   
   if (conversaExistente) existingConversation = conversaExistente;
 }`;

content = content.replace(/export async function findOrCreateContactAndConversation.*?(?=\s+\/\/ 2\. Se não achou)/s, replacement);

const replacement2 = `  // 3. Garante que a Conversa existe (Auto-Heal Update ou Insert)
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
  }`;

content = content.replace(/\/\/ 3\. Garante que a Conversa existe \(Upsert\).*?(?=return \{ contatoId, conversationRecordId \};)/s, replacement2);

fs.writeFileSync('app/api/whatsapp/webhook/services/crm.js', content, 'utf8');
console.log('crm.js atualizado com o Matchmaker!');

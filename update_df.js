const fs = require('fs');
let content = fs.readFileSync('app/(main)/caixa-de-entrada/data-fetching.js', 'utf8');
content = content.replace(
  'export const getMessages = async (supabase, organizacaoId, contatoId) => {', 
  'export const getMessages = async (supabase, organizacaoId, contatoId, phoneNumber) => {'
);
content = content.replace(
  `  const { data, error } = await supabase\r\n  .from('whatsapp_messages')\r\n  .select('*') // ISSO É VITAL: Traz raw_payload e tudo mais\r\n  .eq('organizacao_id', organizacaoId)\r\n  .eq('contato_id', contatoId)\r\n  .order('created_at', { ascending: true })\r\n  .order('id', { ascending: true });`,
  `  let query = supabase\r\n  .from('whatsapp_messages')\r\n  .select('*') // ISSO É VITAL: Traz raw_payload e tudo mais\r\n  .eq('organizacao_id', organizacaoId)\r\n  .eq('contato_id', contatoId);\r\n  \r\n  if (phoneNumber) {\r\n    query = query.or(\`sender_id.eq.\${phoneNumber},receiver_id.eq.\${phoneNumber}\`);\r\n  }\r\n\r\n  const { data, error } = await query\r\n  .order('created_at', { ascending: true })\r\n  .order('id', { ascending: true });`
);
fs.writeFileSync('app/(main)/caixa-de-entrada/data-fetching.js', content, 'utf8');
console.log("Updated data-fetching.js successfully.");

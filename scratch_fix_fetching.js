const fs = require('fs');
let content = fs.readFileSync('app/(main)/caixa-de-entrada/data-fetching.js', 'utf8');

const regex = /export const getMessages = async \(supabase, organizacaoId, contatoId\) => \{\s+if \(!organizacaoId \|\| !contatoId\) return \[\];\s+if \(error\) \{/g;

const replacement = `export const getMessages = async (supabase, organizacaoId, contatoId) => {
  if (!organizacaoId || !contatoId) return [];

  const { data, error } = await supabase
  .from('whatsapp_messages')
  .select('*') // ISSO É VITAL: Traz raw_payload e tudo mais
  .eq('organizacao_id', organizacaoId)
  .eq('contato_id', contatoId)
  .order('sent_at', { ascending: true })
  .order('id', { ascending: true });

  if (error) {`;

content = content.replace(regex, replacement);
fs.writeFileSync('app/(main)/caixa-de-entrada/data-fetching.js', content);

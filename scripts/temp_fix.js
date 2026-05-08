const fs = require('fs');
const path = 'components/email/EmailSignatureConfig.js';
let content = fs.readFileSync(path, 'utf8');

const target = `  const { error } = await supabase.from('email_configuracoes')
  .update(payload)
  .eq('user_id', user.id);

  if (error) throw error;`;

const replacement = `  const { data, error } = await supabase.from('email_configuracoes')
  .update(payload)
  .eq('user_id', user.id)
  .select();

  if (error) throw error;

  if (!data || data.length === 0) {
  const { error: insertError } = await supabase.from('email_configuracoes')
  .insert([payload]);
  if (insertError) throw insertError;
  }`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
console.log("Substituição concluída.");

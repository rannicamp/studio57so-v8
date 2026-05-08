const fs = require('fs');
const path = 'components/email/EmailSignatureConfig.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /const \{ error \} = await supabase\.from\('email_configuracoes'\)[\s\S]*?\.eq\('user_id', user\.id\);[\s\S]*?if \(error\) throw error;/;
const replacement = `const { data, error } = await supabase.from('email_configuracoes')
  .update(payload)
  .eq('user_id', user.id)
  .select();

  if (error) throw error;

  if (!data || data.length === 0) {
    const { error: insertError } = await supabase.from('email_configuracoes')
    .insert([payload]);
    if (insertError) throw insertError;
  }`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Fixed email signature config!');

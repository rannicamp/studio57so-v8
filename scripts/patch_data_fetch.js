const fs = require('fs');

let content = fs.readFileSync('app/(main)/caixa-de-entrada/data-fetching.js', 'utf8').split(/\r?\n/);

for (let i = 0; i < content.length; i++) {
  if (content[i].includes(".update({ is_read: true })")) {
    // We are replacing the old supabase.from update
    // Let's replace the whole block dynamically
  }
}

// Easier to use replace:
const targetSrc = `  // 2. Opcional: mantém o is_read true globalmente na mensagem pro "visto" azul do cliente (WhatsApp behaviour)
  await supabase
  .from('whatsapp_messages')
  .update({ is_read: true })
  .eq('organizacao_id', organizacaoId)
  .eq('contato_id', contatoId)
  .eq('is_read', false);`;

const newSrc = `  // 2. Adiciona o usuário aos recibos das mensagens via RPC
  await supabase.rpc('mark_whatsapp_messages_read_multi', {
    v_contact_id: contatoId,
    v_user_id: userId
  });`;

let file = fs.readFileSync('app/(main)/caixa-de-entrada/data-fetching.js', 'utf8').replace(/\r\n/g, '\n');
file = file.replace(targetSrc, newSrc);

fs.writeFileSync('app/(main)/caixa-de-entrada/data-fetching.js', file);
console.log("Patched data-fetching");

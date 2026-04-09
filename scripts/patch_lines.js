const fs = require('fs');

let content = fs.readFileSync('components/whatsapp/MessagePanel.js', 'utf8').split(/\r?\n/);

// Update markReadMutation
for (let i = 0; i < content.length; i++) {
  if (content[i].includes('if (!contact?.contato_id || !organizacaoId) return;')) {
    content[i] = " if (!contact?.contato_id || !organizacaoId || !user?.id || !contact.conversation_id) return;";
  }
  if (content[i].includes('body: JSON.stringify({ contact_id: contact.contato_id, organizacaoId: organizacaoId })')) {
    content[i] = " body: JSON.stringify({ contact_id: contact.contato_id, organizacao_id: organizacaoId, user_id: user.id, conversation_id: contact.conversation_id })";
  }
  if (content[i].includes('if (contact?.contato_id && messages) {')) {
    content[i] = " if (contact?.contato_id && messages && user?.id) {";
  }
  if (content[i].includes("const hasUnread = messages.some(m => m.direction === 'inbound' && m.is_read === false);")) {
    content[i] = " const hasUnread = messages.some(m => m.direction === 'inbound' && m.read_receipts?.[user.id] !== true);";
  }
  if (content[i].includes("}, [contact?.contato_id, messages]);")) {
    content[i] = " }, [contact?.contato_id, messages, user?.id]);";
  }
}

fs.writeFileSync('components/whatsapp/MessagePanel.js', content.join('\n'));
console.log("Lines patched successfully!");

const fs = require('fs');
let content = fs.readFileSync('components/whatsapp/MessagePanel.js', 'utf8');

// 1. Atualizar o queryKey de ['messages', organizacaoId, contact?.contato_id]
// para ['messages', organizacaoId, contact?.contato_id, contact?.phone_number]
content = content.replace(/\['messages', organizacaoId, contact\?\.contato_id\]/g, "['messages', organizacaoId, contact?.contato_id, contact?.phone_number]");

// 2. Atualizar a chamada do getMessages
content = content.replace(
  "queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),",
  "queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id, contact?.phone_number),"
);

// 3. Atualizar o Realtime filter
content = content.replace(
  "const isRelevant = payload.new.contato_id === contact.contato_id || payload.new.sender_id === recipientPhone;",
  "const isRelevant = payload.new.contato_id === contact.contato_id && (payload.new.sender_id === contact.phone_number || payload.new.receiver_id === contact.phone_number);"
);

fs.writeFileSync('components/whatsapp/MessagePanel.js', content, 'utf8');
console.log('MessagePanel.js atualizado com sucesso.');

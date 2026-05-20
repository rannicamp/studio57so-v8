const fs = require('fs');
let content = fs.readFileSync('components/whatsapp/WhatsAppInbox.js', 'utf8');

const targetStr = `  // Deduplica as conversas para evitar que a mesma pessoa apareça duas vezes
  const conversations = React.useMemo(() => {
  if (!rawConversations) return [];
  const seen = new Set();
  return rawConversations.filter(c => {
  const identifier = c.contato_id || c.phone_number;
  if (!identifier) return true; // Se não tem identificador, deixa passar
  if (seen.has(identifier)) return false;
  seen.add(identifier);
  return true;
  });
  }, [rawConversations]);`;

const targetStrAlt = `  // Deduplica as conversas para evitar que a mesma pessoa apareça duas vezes\r
  const conversations = React.useMemo(() => {\r
  if (!rawConversations) return [];\r
  const seen = new Set();\r
  return rawConversations.filter(c => {\r
  const identifier = c.contato_id || c.phone_number;\r
  if (!identifier) return true; // Se não tem identificador, deixa passar\r
  if (seen.has(identifier)) return false;\r
  seen.add(identifier);\r
  return true;\r
  });\r
  }, [rawConversations]);`;

const replacement = `  // Deduplica as conversas para evitar que a mesma pessoa apareça duas vezes
  const conversations = React.useMemo(() => {
  if (!rawConversations) return [];
  const seen = new Set();
  return rawConversations.filter(c => {
  // CORREÇÃO: Usar phone_number como identificador primário
  const identifier = c.phone_number || c.contato_id;
  if (!identifier) return true; // Se não tem identificador, deixa passar
  if (seen.has(identifier)) return false;
  seen.add(identifier);
  return true;
  });
  }, [rawConversations]);`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
} else {
  content = content.replace(targetStrAlt, replacement);
}

fs.writeFileSync('components/whatsapp/WhatsAppInbox.js', content, 'utf8');
console.log('WhatsAppInbox.js updated.');

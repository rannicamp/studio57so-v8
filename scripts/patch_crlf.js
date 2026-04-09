const fs = require('fs');

function patchFile(path, patchFn) {
  let content = fs.readFileSync(path, 'utf8');
  // Normalize CRLF to LF
  let original = content;
  content = content.replace(/\r\n/g, '\n');
  content = patchFn(content);
  // Optional: convert back to CRLF if needed, or keep LF. Let's just write LF, git usually handles it or windows handles it.
  fs.writeFileSync(path, content);
}

patchFile('app/api/whatsapp/mark-read/route.js', (content) => {
  // We already replaced the destructuring:
  // "const { contact_id, organizacao_id, user_id, conversation_id } = body;"
  // Now replace the rest
  const target = `  // 1. Marca as mensagens como lidas na tabela de mensagens (Histórico)
  await supabaseAdmin
  .from('whatsapp_messages')
  .update({ is_read: true })
  .match({ contato_id: contact_id, direction: 'inbound',
  is_read: false });

  // 2. ZERA o contador na tabela de conversas (Para sumir a bolinha)
  // Isso resolve o problema de performance e sincronia
  const { error } = await supabaseAdmin
  .from('whatsapp_conversations')
  .update({ unread_count: 0 })
  .eq('contato_id', contact_id)
  .eq('organizacao_id', organizacao_id); // 🔥 CORRIGIDO: estava originacaoId`;

  const newCode = `  if (!user_id || !conversation_id) {
    return NextResponse.json({ error: 'Parâmetros de Multi-Traffic ausentes.' }, { status: 400 });
  }

  // 1. Marca as mensagens como lidas via RPC (JSONB Multi-Traffic)
  await supabaseAdmin.rpc('mark_whatsapp_messages_read_multi', {
    v_contact_id: contact_id,
    v_user_id: user_id
  });

  // 2. ZERA o contador INDIVIDUAL de bolinha na tabela de conversas
  const { error } = await supabaseAdmin.rpc('reset_whatsapp_unreads', {
    v_conversation_id: conversation_id,
    v_user_id: user_id
  });`;
  
  return content.replace(target, newCode);
});

patchFile('components/whatsapp/MessagePanel.js', (content) => {
  const targetFn = `  mutationFn: async () => {
  if (!contact?.contato_id || !organizacaoId) return;
  await fetch('/api/whatsapp/mark-read', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contact_id: contact.contato_id, organizacaoId: organizacaoId })
  });
  },`;

  const newFn = `  mutationFn: async () => {
  if (!contact?.contato_id || !organizacaoId || !user?.id || !contact.conversation_id) return;
  await fetch('/api/whatsapp/mark-read', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contact_id: contact.contato_id, organizacao_id: organizacaoId, user_id: user.id, conversation_id: contact.conversation_id })
  });
  },`;

  const targetEffect = `  useEffect(() => {
  if (contact?.contato_id && messages) {
  const hasUnread = messages.some(m => m.direction === 'inbound' && m.is_read === false);
  if (hasUnread) markReadMutation.mutate();
  }
  }, [contact?.contato_id, messages]);`;

  const newEffect = `  useEffect(() => {
  if (contact?.contato_id && messages && user?.id) {
  const hasUnread = messages.some(m => m.direction === 'inbound' && m.read_receipts?.[user.id] !== true);
  if (hasUnread) markReadMutation.mutate();
  }
  }, [contact?.contato_id, messages, user?.id]);`;

  return content.replace(targetFn, newFn).replace(targetEffect, newEffect);
});

console.log("CRLF Patch successful!");

const fs = require('fs');

try {
  let route = fs.readFileSync('app/api/whatsapp/mark-read/route.js', 'utf8');
  
  // Patch Route API
  route = route.replace(/const { contact_id, organizacao_id } = body;/, 'const { contact_id, organizacao_id, user_id, conversation_id } = body;');
  
  const targetRoute = `  // 1. Marca as mensagens como lidas na tabela de mensagens (Histórico)
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
  
  route = route.replace(targetRoute, `  if (!user_id || !conversation_id) {
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
  });`);
  
  fs.writeFileSync('app/api/whatsapp/mark-read/route.js', route);

  let messagePanel = fs.readFileSync('components/whatsapp/MessagePanel.js', 'utf8');

  // Patch Message Panel API Call
  messagePanel = messagePanel.replace(
    `if (!contact?.contato_id || !organizacaoId) return;
  await fetch('/api/whatsapp/mark-read', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contact_id: contact.contato_id, organizacaoId: organizacaoId })
  });`,
    `if (!contact?.contato_id || !organizacaoId || !user?.id || !contact.conversation_id) return;
  await fetch('/api/whatsapp/mark-read', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contact_id: contact.contato_id, organizacao_id: organizacaoId, user_id: user.id, conversation_id: contact.conversation_id })
  });`
  );

  // Patch Message Panel Effect
  messagePanel = messagePanel.replace(
    `useEffect(() => {
  if (contact?.contato_id && messages) {
  const hasUnread = messages.some(m => m.direction === 'inbound' && m.is_read === false);
  if (hasUnread) markReadMutation.mutate();
  }
  }, [contact?.contato_id, messages]);`,
    `useEffect(() => {
  if (contact?.contato_id && messages && user?.id) {
  const hasUnread = messages.some(m => m.direction === 'inbound' && m.read_receipts?.[user.id] !== true);
  if (hasUnread) markReadMutation.mutate();
  }
  }, [contact?.contato_id, messages, user?.id]);`
  );

  fs.writeFileSync('components/whatsapp/MessagePanel.js', messagePanel);

  console.log("Patches applied successfully!");
} catch(e) {
  console.error(e);
}

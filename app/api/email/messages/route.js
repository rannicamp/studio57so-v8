import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const accountId = searchParams.get('accountId');
  let folderParam = searchParams.get('folder');
  const pageParam = searchParams.get('page');
  const searchParam = searchParams.get('search'); 
  const statusParam = searchParams.get('status'); // 'unread', 'read', 'all'
  
  // Normalização de pasta (INBOX vs Inbox)
  let folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
  // Pequeno ajuste para garantir compatibilidade com nomes salvos no sync
  if (folderName === 'INBOX' || folderName === 'inbox') folderName = 'INBOX';

  const page = parseInt(pageParam || '1');
  const pageSize = 20; 

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // --- CONSTRUÇÃO DA QUERY NO BANCO (Offline First) ---
    let query = supabase
        .from('email_messages_cache')
        .select('*', { count: 'exact' });

    // 1. Filtro de Conta
    if (accountId) {
        query = query.eq('account_id', accountId);
    } else {
        // Se não passar conta, pega as do usuário para segurança
        const { data: userAccounts } = await supabase.from('email_configuracoes').select('id').eq('user_id', user.id);
        const accountIds = userAccounts.map(a => a.id);
        query = query.in('account_id', accountIds);
    }

    // 2. Filtro de Pasta
    // (Importante: O sync salva o path exato. Às vezes o front manda 'INBOX', mas no banco tá 'INBOX' ou 'Inbox')
    // Usamos ILIKE para garantir caso o case mude, mas idealmente seria exato.
    query = query.ilike('folder_path', folderName);

    // 3. Filtro de Status
    if (statusParam === 'unread') {
        query = query.eq('is_read', false);
    } else if (statusParam === 'read') {
        query = query.eq('is_read', true);
    }

    // 4. Filtro de Busca (Texto)
    if (searchParam && searchParam.trim() !== '') {
        const term = `%${searchParam}%`;
        // Busca no assunto, remetente, para ou cc
        query = query.or(`subject.ilike.${term},from_text.ilike.${term},to_text.ilike.${term},cc_text.ilike.${term}`);
    }

    // 5. Paginação e Ordenação
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
        .order('date', { ascending: false }) // Mais recentes primeiro
        .range(from, to);

    const { data: messages, error, count } = await query;

    if (error) throw error;

    // Formata para o padrão que o Frontend espera
    const formattedMessages = messages.map(msg => ({
        id: msg.uid,          // O Frontend usa o UID como ID
        seq: msg.uid,
        subject: msg.subject,
        from: msg.from_text,
        date: msg.date,
        is_read: msg.is_read, // Campo crucial para a UI
        flags: msg.is_read ? ['\\Seen'] : [], // Retrocompatibilidade com lógica antiga de flags
        account_id: msg.account_id,
        folder: msg.folder_path,
        has_attachments: msg.conteudo_cache?.attachments?.length > 0
    }));

    return NextResponse.json({ 
        messages: formattedMessages,
        hasMore: (from + pageSize) < count,
        total: count,
        page: page 
    });

  } catch (error) {
    console.error('Erro ao buscar e-mails do banco:', error);
    return NextResponse.json({ error: 'Erro ao carregar mensagens.' }, { status: 500 });
  }
}
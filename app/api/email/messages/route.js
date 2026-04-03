import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
 const supabase = await createClient();
 const { searchParams } = new URL(request.url);
 const accountId = searchParams.get('accountId');
 let folderParam = searchParams.get('folder');
 const pageParam = searchParams.get('page');
 const searchParam = searchParams.get('search'); const statusParam = searchParams.get('status'); // 'unread', 'read', 'all'
 // Normalização de pasta (INBOX vs Inbox)
 let folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
 if (folderName === 'INBOX' || folderName === 'inbox') folderName = 'INBOX';

 const page = parseInt(pageParam || '1');
 const pageSize = 20; const isSearching = searchParam && searchParam.trim() !== '';

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
 const { data: userAccounts } = await supabase.from('email_configuracoes').select('id').eq('user_id', user.id);
 const accountIds = userAccounts.map(a => a.id);
 query = query.in('account_id', accountIds);
 }

 // 2. Filtro de Pasta
 // Quando há busca de texto, varremos TODAS as pastas da conta para encontrar em qualquer lugar.
 // Quando não há busca, filtramos pela pasta selecionada.
 if (!isSearching) {
 query = query.ilike('folder_path', folderName);
 }

 // 3. Filtro de Status
 if (statusParam === 'unread') {
 query = query.eq('is_read', false);
 } else if (statusParam === 'read') {
 query = query.eq('is_read', true);
 }

 // 4. Filtro de Busca (Texto) — busca em TODOS os campos relevantes do e-mail
 if (isSearching) {
 const term = '%' + searchParam.trim() + '%';
 // Busca no assunto, remetente, destinatário, cc E no corpo do e-mail!
 query = query.or(
 'subject.ilike.' + term +
 ',from_text.ilike.' + term +
 ',to_text.ilike.' + term +
 ',cc_text.ilike.' + term +
 ',text_body.ilike.' + term
 );
 }

 // 5. Paginação e Ordenação
 const from = (page - 1) * pageSize;
 const to = from + pageSize - 1;

 query = query
 .order('date', { ascending: false })
 .range(from, to);

 const { data: messages, error, count } = await query;

 if (error) throw error;

 // Função auxiliar para gerar preview limpo do corpo
 const generateSnippet = (textBody, htmlBody, maxLength = 150) => {
 if (textBody) {
 return textBody
 .replace(/\r?\n/g, ' ')
 .replace(/\s+/g, ' ')
 .trim()
 .substring(0, maxLength);
 }
 if (htmlBody) {
 return htmlBody
 .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
 .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
 .replace(/<[^>]+>/g, ' ')
 .replace(/&nbsp;/g, ' ')
 .replace(/\s+/g, ' ')
 .trim()
 .substring(0, maxLength);
 }
 return '';
 };

 // Formata para o padrão que o Frontend espera
 const formattedMessages = messages.map(msg => ({
 id: msg.uid,
 seq: msg.uid,
 subject: msg.subject,
 from: msg.from_text,
 date: msg.date,
 is_read: msg.is_read,
 flags: msg.is_read ? ['\\Seen'] : [],
 account_id: msg.account_id,
 folder: msg.folder_path,
 has_attachments: msg.conteudo_cache?.attachments?.length > 0,
 body_snippet: generateSnippet(msg.text_body, msg.html_body), // Preview do corpo para a lista
 }));

 return NextResponse.json({ messages: formattedMessages,
 hasMore: (from + pageSize) < count,
 total: count,
 page: page,
 isSearchResult: isSearching,
 });

 } catch (error) {
 console.error('Erro ao buscar e-mails do banco:', error);
 return NextResponse.json({ error: 'Erro ao carregar mensagens.' }, { status: 500 });
 }
}
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

    // Buscar configurações da conta de e-mail para validar bypass
    let config = null;
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
      const { data: configs } = await supabase.from('email_configuracoes').select('*').eq('id', accountId);
      config = configs?.[0];
    } else {
      const { data: configs } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).limit(1);
      config = configs?.[0];
    }

    const isDemo = config?.organizacao_id === 57 || 
                   config?.email === 'elo57@studio57.arq.br' || 
                   config?.email?.includes('demo') || 
                   config?.email?.includes('fake') || 
                   config?.email?.includes('vanguard') ||
                   !config; // Fallback

    if (isDemo) {
      const timeNow = new Date();
      const mockMessages = [
        {
          id: 101,
          seq: 101,
          subject: 'Nota Fiscal Eletrônica - Cimento Alfa - NF 15429',
          from: 'faturamento@cimentoalfa.com.br',
          date: new Date(timeNow.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          is_read: false,
          flags: [],
          account_id: accountId || (config?.id || 'demo-account'),
          folder: folderName,
          has_attachments: true,
          body_snippet: 'Prezados, segue em anexo a Nota Fiscal Eletrônica referente ao faturamento da última entrega de cimento usinado no Residencial Vista Parque...',
        },
        {
          id: 102,
          seq: 102,
          subject: 'Proposta de Parceria de Vendas - Lançamento Vista Parque',
          from: 'Rodrigo Silveira <contato@grupometaimoveis.com.br>',
          date: new Date(timeNow.getTime() - 5 * 60 * 60 * 1000).toISOString(),
          is_read: true,
          flags: ['\\Seen'],
          account_id: accountId || (config?.id || 'demo-account'),
          folder: folderName,
          has_attachments: false,
          body_snippet: 'Prezada Diretoria da Vanguard, temos interesse em assinar o termo de parceria de vendas da nossa imobiliária para o Residencial Vista Parque...',
        },
        {
          id: 103,
          seq: 103,
          subject: 'Currículo para Vaga de Engenharia - Carlos Henrique Souza',
          from: 'Carlos Henrique Souza <carlos.henrique@demo.com>',
          date: new Date(timeNow.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          is_read: true,
          flags: ['\\Seen'],
          account_id: accountId || (config?.id || 'demo-account'),
          folder: folderName,
          has_attachments: true,
          body_snippet: 'Prezado RH, envio meu currículo para a vaga de engenharia de obras anunciada no portal...',
        },
        {
          id: 104,
          seq: 104,
          subject: 'Comprovante de Pagamento Parcela de Entrada - João de Souza',
          from: 'João de Souza Beltrano <joao.beltrano@exemplo.com>',
          date: new Date(timeNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          is_read: true,
          flags: ['\\Seen'],
          account_id: accountId || (config?.id || 'demo-account'),
          folder: folderName,
          has_attachments: true,
          body_snippet: 'Prezada equipe financeira, segue em anexo o comprovante de pagamento do boleto de Sinal de Entrada referente ao AP 101...',
        }
      ];

      let filtered = mockMessages;
      if (statusParam === 'unread') {
        filtered = mockMessages.filter(m => !m.is_read);
      } else if (statusParam === 'read') {
        filtered = mockMessages.filter(m => m.is_read);
      }

      if (isSearching) {
        const term = searchParam.trim().toLowerCase();
        filtered = filtered.filter(m => 
          m.subject.toLowerCase().includes(term) ||
          m.from.toLowerCase().includes(term) ||
          m.body_snippet.toLowerCase().includes(term)
        );
      }

      return NextResponse.json({
        messages: filtered,
        hasMore: false,
        total: filtered.length,
        page: 1,
        isSearchResult: isSearching,
      });
    }

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
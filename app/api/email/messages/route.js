import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- DECODIFICADOR ROBUSTO ---
const decodeHeaderValue = (str) => {
    if (!str) return '';
    const unfolded = str.replace(/\r\n\s+/g, ' ');
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;

    if (!encodedWordRegex.test(unfolded)) {
        return unfolded.replace(/^"|"$/g, '');
    }

    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            const lowerCharset = charset.toLowerCase();
            let buffer;
            if (encoding.toUpperCase() === 'B') {
                buffer = Buffer.from(content, 'base64');
            } else {
                const bytes = [];
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    if (char === '_') {
                        bytes.push(32);
                    } else if (char === '=') {
                        const hex = content.substr(i + 1, 2);
                        if (hex && /^[0-9A-Fa-f]{2}$/.test(hex)) {
                            bytes.push(parseInt(hex, 16));
                            i += 2;
                        } else {
                            bytes.push(61);
                        }
                    } else {
                        bytes.push(char.charCodeAt(0));
                    }
                }
                buffer = Buffer.from(bytes);
            }
            const decoder = new TextDecoder(lowerCharset);
            return decoder.decode(buffer);
        } catch (err) {
            return match;
        }
    });
};

const parseHeader = (headerString) => {
    try {
        const cleanHeader = headerString.replace(/\r\n\s+/g, ' ');
        const subjectMatch = cleanHeader.match(/^Subject: (.*)$/im);
        const fromMatch = cleanHeader.match(/^From: (.*)$/im);
        const dateMatch = cleanHeader.match(/^Date: (.*)$/im);

        return {
            subject: decodeHeaderValue(subjectMatch ? subjectMatch[1].trim() : '(Sem Assunto)'),
            from: decodeHeaderValue(fromMatch ? fromMatch[1].replace(/<.*>/, '').trim() : 'Desconhecido'),
            date: dateMatch ? new Date(dateMatch[1]) : new Date()
        };
    } catch (e) {
        return { subject: '(Erro ao ler)', from: 'Erro', date: new Date() };
    }
};

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const folderParam = searchParams.get('folder');
  let folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
  const pageParam = searchParams.get('page');
  const page = parseInt(pageParam || '1');
  const searchParam = searchParams.get('search'); 
  const statusParam = searchParams.get('status'); // 'all', 'read', 'unread'
  
  const pageSize = 20; 

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    const box = await connection.openBox(folderName, { readOnly: true });
    
    let messageIdsToFetch = [];
    let totalMessages = box.messages.total;
    let hasMore = false;

    // Verifica se precisamos usar o modo de BUSCA (mais lento, mas filtrado)
    // Usamos busca se tiver termo de pesquisa OU se o status não for 'all'
    const useSearchMode = (searchParam && searchParam.trim().length > 0) || (statusParam && statusParam !== 'all');

    if (useSearchMode) {
        // --- MODO BUSCA (IMAP SEARCH) ---
        let searchCriteria = [];

        // Filtro de Texto
        if (searchParam && searchParam.trim().length > 0) {
            searchCriteria.push(['OR', 
                ['HEADER', 'SUBJECT', searchParam], 
                ['HEADER', 'FROM', searchParam]
            ]);
        }

        // Filtro de Status (Lido/Não Lido)
        if (statusParam === 'unread') {
            searchCriteria.push('UNSEEN');
        } else if (statusParam === 'read') {
            searchCriteria.push('SEEN');
        }

        // Se não tiver critério nenhum (ex: status='all' e sem busca, mas caiu aqui por erro), busca tudo
        if (searchCriteria.length === 0) {
            searchCriteria = ['ALL'];
        }
        
        // Busca apenas os UIDs
        const searchResults = await connection.search(searchCriteria, { results: 'results' });
        
        // Ordena do mais recente para o antigo
        searchResults.sort((a, b) => b.attributes.uid - a.attributes.uid);
        
        totalMessages = searchResults.length;
        
        // Paginação
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const slicedResults = searchResults.slice(startIndex, endIndex);
        
        messageIdsToFetch = slicedResults.map(m => m.attributes.uid);
        hasMore = endIndex < totalMessages;

        if (messageIdsToFetch.length === 0) {
             return NextResponse.json({ messages: [], hasMore: false, total: 0, page });
        }

    } else {
        // --- MODO SEQUENCIAL (Padrão Rápido para 'Todas') ---
        if (totalMessages === 0) {
            return NextResponse.json({ messages: [], hasMore: false, total: 0 });
        }

        const endSeq = totalMessages - ((page - 1) * pageSize);
        const startSeq = Math.max(1, endSeq - pageSize + 1);

        if (endSeq < 1) {
            return NextResponse.json({ messages: [], hasMore: false, total: totalMessages });
        }
        
        messageIdsToFetch = `${startSeq}:${endSeq}`; 
        hasMore = startSeq > 1;
    }

    // --- FETCH DOS CABEÇALHOS ---
    const fetchOptions = {
      bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', 
      struct: true
    };

    const emailList = await new Promise((resolve, reject) => {
        const fetched = [];
        let f;
        
        // Diferença técnica: fetch sequencial (string) vs fetch por UID (array)
        if (typeof messageIdsToFetch === 'string') {
             f = connection.imap.seq.fetch(messageIdsToFetch, fetchOptions);
        } else {
             f = connection.imap.fetch(messageIdsToFetch, fetchOptions);
        }
        
        f.on('message', (msg, seqno) => {
            let headerRaw = '';
            let attributes;
            
            msg.on('body', (stream) => {
                stream.on('data', (chunk) => { headerRaw += chunk.toString('utf8'); });
            });
            
            msg.on('attributes', (attrs) => { attributes = attrs; });
            
            msg.on('end', () => {
                const parsed = parseHeader(headerRaw);
                fetched.push({
                    id: attributes?.uid || seqno,
                    seq: seqno,
                    subject: parsed.subject,
                    from: parsed.from,
                    date: parsed.date,
                    flags: attributes?.flags || []
                });
            });
        });

        f.once('error', (err) => reject(err));
        f.once('end', () => resolve(fetched));
    });

    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ 
        messages: emailList,
        hasMore: hasMore,
        total: totalMessages,
        page: page 
    });

  } catch (error) {
    console.error(`Erro Pasta ${folderName}:`, error);
    if (error.message.includes('Mailsbox not found') || error.message.includes('doesn\'t exist')) {
        return NextResponse.json({ error: `Pasta indisponível.` }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro de conexão.' }, { status: 500 });
  } finally {
    if (connection) {
        try { connection.end(); } catch (e) {}
    }
  }
}
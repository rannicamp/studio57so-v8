import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// Função auxiliar simples para ler cabeçalhos sem bibliotecas pesadas
const parseHeader = (headerString) => {
    try {
        const subjectMatch = headerString.match(/^Subject: (.*)$/im);
        const fromMatch = headerString.match(/^From: (.*)$/im);
        const dateMatch = headerString.match(/^Date: (.*)$/im);
        
        // Decodificação básica de UTF-8 (ex: =?UTF-8?B?...)
        const decode = (str) => {
            if (!str) return '';
            // Remove aspas extras se houver
            str = str.replace(/^"|"$/g, '');
            
            if (str.startsWith('=?') && typeof Buffer !== 'undefined') {
                const parts = str.split('?');
                if (parts[2] === 'B') return Buffer.from(parts[3], 'base64').toString('utf-8');
                if (parts[2] === 'Q') return parts[3].replace(/=/g, '%').replace(/_/g, ' '); 
            }
            return str;
        };

        return {
            subject: decode(subjectMatch ? subjectMatch[1] : '(Sem Assunto)'),
            from: decode(fromMatch ? fromMatch[1] : 'Desconhecido'),
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
  const pageParam = searchParams.get('page'); // <--- NOVO: Parâmetro de página
  
  // Se não vier pasta, assume INBOX.
  const folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
  const page = parseInt(pageParam || '1'); // Página padrão é 1
  const pageSize = 50; // Quantos e-mails por vez

  try {
    // 1. Segurança e Configuração
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

    // 2. Conexão IMAP
    const imapConfig = {
      imap: {
        user: config.imap_user || config.email,
        password: config.senha_app,
        host: config.imap_host,
        port: config.imap_port || 993,
        tls: true,
        authTimeout: 20000, 
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    const connection = await imapSimple.connect(imapConfig);
    
    // 3. Abrir Pasta
    const box = await connection.openBox(folderName);
    const totalMessages = box.messages.total;

    if (totalMessages === 0) {
        connection.end();
        return NextResponse.json({ messages: [], hasMore: false, total: 0 });
    }

    // 4. Lógica de Paginação (A Mágica Acontece Aqui)
    // IMAP usa sequencia baseada em 1. O ultimo numero (total) é o mais recente.
    // Pagina 1: Pega do (Total) até (Total - 49)
    // Pagina 2: Pega do (Total - 50) até (Total - 99)
    
    // Calculamos onde termina esta página (de cima para baixo)
    const endSeq = totalMessages - ((page - 1) * pageSize);
    
    // Se o fim for menor que 1, não tem mais mensagens antigas
    if (endSeq < 1) {
        connection.end();
        return NextResponse.json({ messages: [], hasMore: false, total: totalMessages });
    }

    // Calculamos onde começa (o inicio não pode ser menor que 1)
    const startSeq = Math.max(1, endSeq - pageSize + 1);
    
    const sequence = `${startSeq}:${endSeq}`;
    
    console.log(`Buscando e-mails da pasta ${folderName}: Seq ${sequence} (Pag ${page})`);

    const fetchOptions = {
      bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', 
      struct: true
    };

    // Uso direto do node-imap para performance
    const emailList = await new Promise((resolve, reject) => {
        const fetched = [];
        // fetch por sequencia
        const f = connection.imap.seq.fetch(sequence, fetchOptions);
        
        f.on('message', (msg, seqno) => {
            let attributes;
            let headerRaw = '';
            
            msg.on('body', (stream) => {
                stream.on('data', (chunk) => { headerRaw += chunk.toString('utf8'); });
            });
            
            msg.on('attributes', (attrs) => { attributes = attrs; });
            
            msg.on('end', () => {
                const parsed = parseHeader(headerRaw);
                fetched.push({
                    id: attributes?.uid || seqno, // UID é melhor para chave única
                    seq: seqno,
                    subject: parsed.subject,
                    from: parsed.from.replace(/<.*>/, '').trim(), 
                    date: parsed.date,
                    flags: attributes?.flags || []
                });
            });
        });
        
        f.once('error', (err) => reject(err));
        f.once('end', () => resolve(fetched));
    });

    // Ordena do mais novo para o mais velho (descendente) dentro dessa página
    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));

    connection.end();

    // Se o startSeq for 1, significa que chegamos no fundo do baú (primeiro e-mail da história)
    const hasMore = startSeq > 1;

    return NextResponse.json({ 
        messages: emailList,
        hasMore: hasMore,
        total: totalMessages,
        page: page 
    });

  } catch (error) {
    console.error('Erro API Email:', error);
    return NextResponse.json({ error: 'Erro ao buscar e-mails: ' + error.message }, { status: 500 });
  }
}
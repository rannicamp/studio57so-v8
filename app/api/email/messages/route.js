import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- DECODIFICADOR ROBUSTO (MANTIDO) ---
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
  
  // Tratamento especial para nomes de pastas com espaços ou caracteres especiais
  const folderParam = searchParams.get('folder');
  let folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';

  // Correção comum: Hostinger as vezes usa INBOX.Trash ou INBOX.Sent
  // Se der erro, o log vai nos avisar, mas mantemos o padrão enviado pelo front
  
  const pageParam = searchParams.get('page');
  const page = parseInt(pageParam || '1');
  
  // ESTRATÉGIA ANTI-BLOQUEIO:
  // Reduzimos para 20 e-mails por vez. É melhor carregar 20 rápido do que tentar 50 e travar.
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
        authTimeout: 30000, // 30 segundos de paciência
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    
    // --- O SEGREDO DO SUCESSO ---
    // readOnly: true -> Diz ao servidor: "Não vou deletar nem mover nada, só olhar".
    // Isso faz o servidor liberar o acesso muito mais rápido e sem travas de 'lock'.
    const box = await connection.openBox(folderName, { readOnly: true });
    
    const totalMessages = box.messages.total;

    if (totalMessages === 0) {
        return NextResponse.json({ messages: [], hasMore: false, total: 0 });
    }

    // Matemática de Paginação pelo ID Sequencial (O mais leve possível)
    // Se temos 100 mensagens, pag 1 pega 100 a 81. Pag 2 pega 80 a 61.
    const endSeq = totalMessages - ((page - 1) * pageSize);
    const startSeq = Math.max(1, endSeq - pageSize + 1);

    if (endSeq < 1) {
        return NextResponse.json({ messages: [], hasMore: false, total: totalMessages });
    }

    const sequence = `${startSeq}:${endSeq}`;

    // Pedimos APENAS o cabeçalho. Não baixamos o corpo do email agora.
    const fetchOptions = {
      bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', 
      struct: true
    };

    const emailList = await new Promise((resolve, reject) => {
        const fetched = [];
        // fetch direto por sequência numéria - ZERO processamento do servidor
        const f = connection.imap.seq.fetch(sequence, fetchOptions);
        
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

    // Ordenamos no Javascript (cliente), para não gastar CPU do servidor Hostinger
    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ 
        messages: emailList,
        hasMore: startSeq > 1,
        total: totalMessages,
        page: page 
    });

  } catch (error) {
    console.error(`Erro Pasta ${folderName}:`, error);
    // Retorna mensagem amigável se for problema de pasta não existente
    if (error.message.includes('Mailsbox not found') || error.message.includes('doesn\'t exist')) {
        return NextResponse.json({ error: `A pasta "${folderName}" não está acessível ou tem um nome diferente no servidor.` }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro de conexão: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
        try {
            connection.end();
        } catch (e) {}
    }
  }
}
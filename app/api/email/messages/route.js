import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- SUPER DECODIFICADOR DE CABEÇALHOS (Versão PT-BR) ---
const decodeHeaderValue = (str) => {
    if (!str) return '';

    // 1. Unfold: Junta linhas que foram quebradas (padrão RFC 2822)
    const unfolded = str.replace(/\r\n\s+/g, ' ');

    // 2. Regex para encontrar palavras codificadas
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
            console.error('Erro ao decodificar:', match, err);
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
  const pageParam = searchParams.get('page');
  
  const folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
  const page = parseInt(pageParam || '1');
  const pageSize = 50;

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
        authTimeout: 20000, 
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    const connection = await imapSimple.connect(imapConfig);
    const box = await connection.openBox(folderName);
    const totalMessages = box.messages.total;

    if (totalMessages === 0) {
        connection.end();
        return NextResponse.json({ messages: [], hasMore: false, total: 0 });
    }

    const endSeq = totalMessages - ((page - 1) * pageSize);
    if (endSeq < 1) {
        connection.end();
        return NextResponse.json({ messages: [], hasMore: false, total: totalMessages });
    }
    const startSeq = Math.max(1, endSeq - pageSize + 1);
    const sequence = `${startSeq}:${endSeq}`;

    const fetchOptions = {
      bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', 
      struct: true
    };

    const emailList = await new Promise((resolve, reject) => {
        const fetched = [];
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

    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));
    connection.end();

    return NextResponse.json({ 
        messages: emailList,
        hasMore: startSeq > 1,
        total: totalMessages,
        page: page 
    });

  } catch (error) {
    console.error('Erro API Email:', error);
    return NextResponse.json({ error: 'Erro ao buscar e-mails: ' + error.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';

// --- SUPER DECODIFICADOR DE CABEÇALHOS (Versão PT-BR) ---
// Resolve problemas de acentos (ç, ã, é), ISO-8859-1 e quebras de linha
const decodeHeaderValue = (str) => {
    if (!str) return '';

    // 1. Unfold: Junta linhas que foram quebradas (padrão RFC 2822)
    // Removemos o \r\n seguido de espaço para colar o texto de volta
    const unfolded = str.replace(/\r\n\s+/g, ' ');

    // 2. Regex para encontrar palavras codificadas: =?charset?encoding?content?=
    // Ex: =?iso-8859-1?Q?Promo=E7=E3o?=
    const encodedWordRegex = /=\?([\w-]+)\?([BbQq])\?([^\?]*)\?=/g;

    // Se não tiver cara de codificado, retorna a string limpa
    if (!encodedWordRegex.test(unfolded)) {
        return unfolded.replace(/^"|"$/g, ''); // Remove aspas extras
    }

    // 3. Substituir cada parte codificada
    return unfolded.replace(encodedWordRegex, (match, charset, encoding, content) => {
        try {
            // Normaliza o charset (ex: ISO-8859-1 vira iso-8859-1)
            const lowerCharset = charset.toLowerCase();
            let buffer;

            if (encoding.toUpperCase() === 'B') {
                // Base64
                buffer = Buffer.from(content, 'base64');
            } else {
                // Quoted-Printable (Q)
                // Substitui _ por espaço e =XX pelo byte hexadecimal
                const bytes = [];
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    if (char === '_') {
                        bytes.push(32); // Espaço
                    } else if (char === '=') {
                        const hex = content.substr(i + 1, 2);
                        // Verifica se é um hex válido
                        if (hex && /^[0-9A-Fa-f]{2}$/.test(hex)) {
                            bytes.push(parseInt(hex, 16));
                            i += 2; // Pula os 2 caracteres do hex
                        } else {
                            bytes.push(61); // Deixa o = literal (raro)
                        }
                    } else {
                        bytes.push(char.charCodeAt(0));
                    }
                }
                buffer = Buffer.from(bytes);
            }

            // A Mágica: TextDecoder lida nativamente com os padrões do Brasil (iso-8859-1, windows-1252)
            const decoder = new TextDecoder(lowerCharset);
            return decoder.decode(buffer);

        } catch (err) {
            console.error('Erro ao decodificar trecho:', match, err);
            return match; // Se falhar, retorna o original para não quebrar tudo
        }
    });
};

const parseHeader = (headerString) => {
    try {
        // Primeiro, limpamos as quebras de linha para o Regex funcionar no texto todo
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
  const pageParam = searchParams.get('page'); // Suporte à paginação
  
  const folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';
  const page = parseInt(pageParam || '1');
  const pageSize = 50;

  try {
    // 1. Segurança
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });

    // 2. Conexão
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
    
    // 3. Abrir Pasta e Contar
    const box = await connection.openBox(folderName);
    const totalMessages = box.messages.total;

    if (totalMessages === 0) {
        connection.end();
        return NextResponse.json({ messages: [], hasMore: false, total: 0 });
    }

    // 4. Calcular Sequência (Lógica de Paginação)
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

    // 5. Buscar e Processar
    const emailList = await new Promise((resolve, reject) => {
        const fetched = [];
        const f = connection.imap.seq.fetch(sequence, fetchOptions);
        
        f.on('message', (msg, seqno) => {
            let attributes;
            let headerRaw = '';
            
            msg.on('body', (stream) => {
                stream.on('data', (chunk) => { headerRaw += chunk.toString('utf8'); });
            });
            
            msg.on('attributes', (attrs) => { attributes = attrs; });
            
            msg.on('end', () => {
                // Aqui usamos o novo parseHeader robusto
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

    // Ordena do mais novo para o mais velho
    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));

    connection.end();

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
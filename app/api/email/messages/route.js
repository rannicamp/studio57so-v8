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
            if (str.startsWith('=?') && typeof Buffer !== 'undefined') {
                const parts = str.split('?');
                if (parts[2] === 'B') return Buffer.from(parts[3], 'base64').toString('utf-8');
                if (parts[2] === 'Q') return parts[3].replace(/=/g, '%').replace(/_/g, ' '); // Simplificado
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
  // Se não vier pasta, assume INBOX. Decodifica caracteres especiais.
  const folderName = folderParam ? decodeURIComponent(folderParam) : 'INBOX';

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
        authTimeout: 15000, // Aumentei para 15s
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    const connection = await imapSimple.connect(imapConfig);
    
    // 3. Abrir Pasta
    const box = await connection.openBox(folderName);
    const totalMessages = box.messages.total;

    if (totalMessages === 0) {
        connection.end();
        return NextResponse.json({ messages: [] });
    }

    // 4. Buscar últimos 50 (Estratégia de Sequência)
    const limit = 50;
    const start = Math.max(1, totalMessages - limit + 1);
    const sequence = `${start}:${totalMessages}`;

    const fetchOptions = {
      bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', // Pede campos específicos (mais rápido e seguro)
      struct: true
    };

    // Uso direto do node-imap para performance
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
                const parsed = parseHeader(headerRaw);
                fetched.push({
                    id: attributes?.uid || seqno,
                    seq: seqno,
                    subject: parsed.subject,
                    from: parsed.from.replace(/<.*>/, '').trim(), // Limpa o email <...> do nome
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

    return NextResponse.json({ messages: emailList });

  } catch (error) {
    console.error('Erro API Email:', error);
    return NextResponse.json({ error: 'Erro ao buscar e-mails: ' + error.message }, { status: 500 });
  }
}
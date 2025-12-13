import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const folderName = searchParams.get('folder') || 'INBOX'; // Pega o nome da pasta clicada

  try {
    // 1. Autenticação e Configuração (Igual ao anterior)
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
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    // 2. Conectar e Abrir a Pasta
    const connection = await imapSimple.connect(imapConfig);
    
    // Abre a pasta específica (ex: INBOX)
    await connection.openBox(folderName);

    // 3. Estratégia de Busca Rápida (Últimos 20 e-mails)
    // O '*' significa o último e-mail. '*-19' significa 20 atrás.
    const searchCriteria = ['1:*']; // Pega tudo se for pouco, ou ajustamos range
    const fetchOptions = {
      bodies: ['HEADER'], // Pega apenas o cabeçalho primeiro (RÁPIDO)
      struct: true,
      markSeen: false
    };

    // Para ser eficiente, pegamos o total de mensagens e calculamos o range
    // Mas para simplificar a V1, vamos buscar os headers dos últimos 50
    const delay = 24 * 3600 * 1000 * 30; // Últimos 30 dias (exemplo)
    const since = new Date();
    since.setTime(since.getTime() - delay);
    const searchSince = [['SINCE', since]];

    const messages = await connection.search(searchSince, fetchOptions);
    
    // 4. Processar os dados para o Front
    const emailList = messages.map(msg => {
      const header = msg.parts.find(p => p.which === 'HEADER');
      const body = header?.body || {};
      
      return {
        id: msg.attributes.uid,
        seq: msg.seq,
        subject: body.subject?.[0] || '(Sem assunto)',
        from: body.from?.[0] || 'Desconhecido',
        date: body.date?.[0] || msg.attributes.date,
        flags: msg.attributes.flags
      };
    });

    // Ordenar do mais novo para o mais velho
    emailList.sort((a, b) => new Date(b.date) - new Date(a.date));

    connection.end();

    return NextResponse.json({ messages: emailList });

  } catch (error) {
    console.error('Erro ao ler mensagens:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
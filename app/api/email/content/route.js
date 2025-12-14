import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const folderParam = searchParams.get('folder');
  const uidParam = searchParams.get('uid');
  
  if (!folderParam || !uidParam) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

  const folderName = decodeURIComponent(folderParam);
  const uid = parseInt(uidParam);

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
        authTimeout: 15000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    connection = await imapSimple.connect(imapConfig);
    await connection.openBox(folderName, { readOnly: true }); // Leitura rápida

    const fetchOptions = { bodies: [''], markSeen: false }; // Pega o corpo todo
    const messages = await connection.search([['UID', uid]], fetchOptions);

    if (messages.length === 0) return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 404 });

    const message = messages[0];
    const allBody = message.parts.find(part => part.which === '');
    const parsed = await simpleParser(allBody.body);

    return NextResponse.json({ 
        id: message.attributes.uid,
        subject: parsed.subject,
        from: parsed.from?.text || 'Desconhecido',
        to: parsed.to?.text,
        date: parsed.date,
        html: parsed.html || false, 
        text: parsed.textAsHtml || parsed.text, 
        attachments: parsed.attachments || []
    });

  } catch (error) {
    console.error('Erro leitura:', error);
    return NextResponse.json({ error: 'Erro ao ler e-mail' }, { status: 500 });
  } finally {
    if (connection) try { connection.end(); } catch (e) {}
  }
}
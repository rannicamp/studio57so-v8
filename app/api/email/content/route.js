import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function GET(request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const folderParam = searchParams.get('folder');
  const uidParam = searchParams.get('uid');
  // NOVO: Recebe o ID da conta
  const accountId = searchParams.get('accountId');
  
  if (!folderParam || !uidParam) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

  const folderName = decodeURIComponent(folderParam);
  const uid = parseInt(uidParam);

  let connection = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // --- CORREÇÃO PRINCIPAL: Lógica Multi-Contas ---
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    
    // Se o painel mandou o ID da conta, usamos ele.
    if (accountId && accountId !== 'undefined' && accountId !== 'null') {
        query = query.eq('id', accountId);
    }
    
    const { data: configs } = await query;
    // Pega a primeira configuração encontrada (seja a específica filtrada ou a padrão)
    const config = configs?.[0];

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
    await connection.openBox(folderName, { readOnly: true });

    const fetchOptions = { bodies: [''], markSeen: false }; 
    const messages = await connection.search([['UID', uid]], fetchOptions);

    if (messages.length === 0) return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 404 });

    const message = messages[0];
    
    // --- PROTEÇÃO DE LEITURA ---
    // Alguns servidores retornam o corpo como '' e outros como 'TEXT'. 
    // Isso evita quebra se o formato variar.
    const allBodyPart = message.parts.find(part => part.which === '') || message.parts.find(part => part.which === 'TEXT');
    
    // Fallback: se não achar corpo principal, pega o primeiro que tiver 'TEXT' no tipo
    const finalBodyPart = allBodyPart || message.parts[0];

    if (!finalBodyPart || !finalBodyPart.body) {
        return NextResponse.json({ error: 'Conteúdo vazio ou ilegível.' }, { status: 500 });
    }

    const parsed = await simpleParser(finalBodyPart.body);

    return NextResponse.json({ 
        id: message.attributes.uid,
        subject: parsed.subject || '(Sem Assunto)',
        from: parsed.from?.text || 'Desconhecido',
        to: parsed.to?.text,
        date: parsed.date,
        html: parsed.html || false, 
        text: parsed.textAsHtml || parsed.text || '', 
        attachments: parsed.attachments || []
    });

  } catch (error) {
    console.error('Erro leitura:', error);
    return NextResponse.json({ error: 'Erro ao ler e-mail: ' + error.message }, { status: 500 });
  } finally {
    if (connection) try { connection.end(); } catch (e) {}
  }
}
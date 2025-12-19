import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';
import imapSimple from 'imap-simple';
import MailComposer from 'nodemailer/lib/mail-composer';

// --- CONFIGURAÇÕES PARA ARQUIVOS GRANDES ---
export const dynamic = 'force-dynamic'; // Não faz cache
export const maxDuration = 60; // Aumenta o tempo limite para 60 segundos

export async function POST(request) {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Tenta ler o JSON. Se falhar aqui, é porque o arquivo é GIGANTE demais para o servidor
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'O arquivo é muito grande para o servidor processar.' }, { status: 413 });
    }

    const { to, cc, bcc, subject, html, replyToMessageId, attachments, accountId } = body;

    // --- VALIDAÇÃO ---
    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
    }

    // --- BUSCA CONFIGURAÇÃO ---
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId) query = query.eq('id', accountId);
    
    const { data: configs } = await query;
    const config = configs?.[0];

    if (!config) return NextResponse.json({ error: 'Configure seu SMTP primeiro.' }, { status: 404 });

    // 1. CONFIGURA O TRANSPORTE (ENVIO)
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_user || config.email,
        pass: config.senha_app,
      },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"${config.nome_remetente || user.email}" <${config.email}>`,
      to, cc, bcc, subject, html,
      ...(replyToMessageId && { inReplyTo: replyToMessageId, references: [replyToMessageId] }),
      attachments: attachments || []
    };

    // 2. ENVIA O E-MAIL (SMTP)
    const info = await transporter.sendMail(mailOptions);
    console.log("E-mail enviado via SMTP:", info.messageId);

    // 3. SALVA NA PASTA ENVIADOS (IMAP APPEND)
    // Esse passo é crucial para e-mails corporativos/cPanel
    try {
        const imapConfig = {
            imap: {
                user: config.imap_user || config.email,
                password: config.senha_app,
                host: config.imap_host,
                port: config.imap_port || 993,
                tls: true,
                authTimeout: 20000, // Tempo maior para salvar o anexo
                tlsOptions: { rejectUnauthorized: false }
            },
        };

        const connection = await imapSimple.connect(imapConfig);
        const boxes = await connection.getBoxes();

        // Tenta adivinhar a pasta de enviados
        let sentFolder = 'Sent'; 
        
        const findSentBox = (list, parent = '') => {
            for (const [key, value] of Object.entries(list)) {
                const fullPath = parent ? `${parent}${value.delimiter}${key}` : key;
                if (['SENT', 'ENVIADOS', 'SENT ITEMS', 'ITENS ENVIADOS'].some(k => key.toUpperCase().includes(k))) {
                    return fullPath;
                }
                if (value.children) {
                    const found = findSentBox(value.children, fullPath);
                    if (found) return found;
                }
            }
            return null;
        };

        const foundSent = findSentBox(boxes);
        if (foundSent) sentFolder = foundSent;

        // Compila o e-mail para salvar
        const composer = new MailComposer(mailOptions);
        const rawMessage = await composer.compile().build();

        await connection.append(rawMessage, {
            mailbox: sentFolder,
            flags: ['\\Seen']
        });
        
        connection.end();

    } catch (saveError) {
        console.error("Aviso: Falha ao salvar nos Enviados (mas o e-mail foi enviado):", saveError.message);
    }

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Falha no envio: ' + error.message }, { status: 500 });
  }
}
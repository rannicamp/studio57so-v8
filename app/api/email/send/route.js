import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';
import imapSimple from 'imap-simple';
import MailComposer from 'nodemailer/lib/mail-composer';

// Configurações para garantir execução longa se necessário
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function POST(request) {
  const supabase = await createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 1. Recebe os dados. Agora 'attachments' é um array de { filename, path }
    // O 'path' é a URL pública do Supabase, o que deixa o JSON super leve!
    const { to, cc, bcc, subject, html, replyToMessageId, attachments, accountId } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
    }

    // --- BUSCA CONFIGURAÇÃO ---
    let query = supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
    if (accountId) query = query.eq('id', accountId);
    
    const { data: configs } = await query;
    const config = configs?.[0];

    if (!config) return NextResponse.json({ error: 'Configure seu SMTP primeiro.' }, { status: 404 });

    // 2. CONFIGURA O TRANSPORTE (SMTP)
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

    // 3. PREPARA O E-MAIL
    // O Nodemailer é inteligente: se passamos 'path' com URL, ele baixa e anexa sozinho!
    const mailOptions = {
      from: `"${config.nome_remetente || user.email}" <${config.email}>`,
      to, cc, bcc, subject, html,
      ...(replyToMessageId && { inReplyTo: replyToMessageId, references: [replyToMessageId] }),
      attachments: attachments || [] 
    };

    // 4. ENVIA
    const info = await transporter.sendMail(mailOptions);
    console.log("E-mail enviado via SMTP:", info.messageId);

    // 5. SALVA NA PASTA ENVIADOS (IMAP)
    try {
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
        const boxes = await connection.getBoxes();

        let sentFolder = 'Sent'; 
        const findSentBox = (list, parent = '') => {
            for (const [key, value] of Object.entries(list)) {
                const fullPath = parent ? `${parent}${value.delimiter}${key}` : key;
                if (['SENT', 'ENVIADOS', 'ITENS ENVIADOS'].some(k => key.toUpperCase().includes(k))) {
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

        const composer = new MailComposer(mailOptions);
        const rawMessage = await composer.compile().build();

        await connection.append(rawMessage, {
            mailbox: sentFolder,
            flags: ['\\Seen']
        });
        
        connection.end();

    } catch (saveError) {
        console.error("Aviso: Enviado, mas falha ao salvar em Enviados:", saveError.message);
    }

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Falha no envio: ' + error.message }, { status: 500 });
  }
}
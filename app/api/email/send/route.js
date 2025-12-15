import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { to, cc, bcc, subject, html, replyToMessageId, attachments } = await request.json();

    // --- VALIDAÇÃO DETALHADA ---
    const missingFields = [];
    if (!to) missingFields.push("Para (Destinatário)");
    if (!subject) missingFields.push("Assunto");
    if (!html) missingFields.push("Mensagem (Corpo do e-mail)");

    if (missingFields.length > 0) {
      return NextResponse.json({ 
          error: `Campos obrigatórios faltando: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }
    // ---------------------------

    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configure seu SMTP primeiro.' }, { status: 404 });

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
      to,
      cc,
      bcc,
      subject,
      html,
      ...(replyToMessageId && {
          inReplyTo: replyToMessageId,
          references: [replyToMessageId]
      }),
      attachments: attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("E-mail enviado:", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Falha no envio: ' + error.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  const supabase = createClient();
  
  try {
    // 1. Verificar Autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Receber dados do corpo (incluindo anexos)
    const { to, cc, bcc, subject, html, replyToMessageId, attachments } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    // 3. Buscar Configurações SMTP
    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configure seu SMTP primeiro.' }, { status: 404 });

    // 4. Configurar o Transporter
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

    // 5. Montar o E-mail
    const mailOptions = {
      from: `"${config.nome_remetente || user.email}" <${config.email}>`,
      to,
      cc,
      bcc,
      subject,
      html,
      // Se houver resposta, adiciona headers
      ...(replyToMessageId && {
          inReplyTo: replyToMessageId,
          references: [replyToMessageId]
      }),
      // Se houver anexos, adiciona ao objeto
      attachments: attachments || []
    };

    // 6. Enviar
    const info = await transporter.sendMail(mailOptions);
    console.log("E-mail enviado:", info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Falha no envio: ' + error.message }, { status: 500 });
  }
}
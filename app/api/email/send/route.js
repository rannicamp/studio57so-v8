import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  const supabase = createClient();
  
  try {
    // 1. Verificar Autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 2. Receber dados do corpo
    const { to, cc, bcc, subject, html, replyToMessageId } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando (Para, Assunto, Mensagem)' }, { status: 400 });
    }

    // 3. Buscar Configurações SMTP do Usuário
    const { data: config } = await supabase
      .from('email_configuracoes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config) return NextResponse.json({ error: 'Configure seu SMTP primeiro.' }, { status: 404 });

    // 4. Configurar o Transporter (Nodemailer)
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587, // Padrão 587 ou 465
      secure: config.smtp_port === 465, // True para 465, false para outros
      auth: {
        user: config.smtp_user || config.email,
        pass: config.senha_app,
      },
      tls: {
        rejectUnauthorized: false // Ajuda a evitar erros de certificado em alguns provedores
      }
    });

    // 5. Montar o E-mail
    const mailOptions = {
      from: `"${config.nome_remetente || user.email}" <${config.email}>`,
      to,
      cc,
      bcc,
      subject,
      html, // Corpo HTML do Tiptap
    };

    // Se for resposta, adiciona headers de threading para agrupar conversas
    if (replyToMessageId) {
        mailOptions.inReplyTo = replyToMessageId;
        mailOptions.references = [replyToMessageId];
    }

    // 6. Enviar
    const info = await transporter.sendMail(mailOptions);
    console.log("E-mail enviado:", info.messageId);

    // Opcional: Salvar na tabela 'sent' ou similar se desejar logar no banco
    // Por padrão, via SMTP, o e-mail já vai para a pasta "Enviados" do provedor (Gmail/Outlook fazem isso auto)

    return NextResponse.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json({ error: 'Falha no envio: ' + error.message }, { status: 500 });
  }
}
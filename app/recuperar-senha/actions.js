// app/recuperar-senha/actions.js
'use server';

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function solicitarRecuperacaoSenhaAction(email, origin) {
  try {
    const emailLimpo = email?.toLowerCase().trim();
    if (!emailLimpo) return { error: 'E-mail inválido.' };

    // Instancia o cliente admin com a service role key do servidor
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Gera o link de recuperação usando a API Admin do Supabase
    const redirectUrl = `${origin}/atualizar-senha`;
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: emailLimpo,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !data?.properties?.action_link) {
      console.error("[Recuperar Senha Action] Erro ao gerar link no Supabase:", linkError);
      return { error: linkError?.message || 'Erro ao gerar link de recuperação.' };
    }

    const actionLink = data.properties.action_link;

    // 2. Busca credenciais globais do remetente
    const { data: config } = await supabaseAdmin
      .from('email_configuracoes')
      .select('*')
      .eq('email', 'elo57@studio57.arq.br')
      .limit(1)
      .maybeSingle();

    if (!config) {
      console.error("[Recuperar Senha Action] Credenciais do elo57@studio57.arq.br nao encontradas no banco.");
      return { error: 'O servidor de envio de e-mails não está configurado.' };
    }

    // 3. Envia o e-mail personalizado via Nodemailer
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 465,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_user || config.email,
        pass: config.senha_app
      },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"${config.nome_remetente || 'Elo 57'}" <${config.email}>`,
      to: emailLimpo,
      subject: `Recuperação de Senha - Elo 57`,
      html: `
        <div style="font-family: sans-serif; padding: 25px; color: #1e293b; background-color: #f8fafc; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://studio57.arq.br/marca/logo-elo57-horizontal.svg" alt="Elo 57" style="height: 32px; width: auto; border: none; display: inline-block; outline: none;" />
            <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; font-weight: 500;">Recuperação de Acesso</p>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.5;">Olá! Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Elo 57</strong>.</p>
            <p style="font-size: 14px; color: #475569; margin: 0 0 25px 0;">Clique no botão abaixo para escolher uma nova senha:</p>
            <div style="margin-bottom: 25px;">
              <a href="${actionLink}" style="background-color: #f25a2f; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; transition: background-color 0.2s;">
                Redefinir Minha Senha
              </a>
            </div>
            <p style="font-size: 11px; color: #94a3b8; margin: 20px 0 0 0; line-height: 1.4;">Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br/>
              <a href="${actionLink}" style="color: #3b82f6; word-break: break-all; font-size: 11px;">${actionLink}</a>
            </p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Este link de recuperação expira em 1 hora. Se você não solicitou a redefinição de senha, nenhuma ação é necessária e você pode ignorar este e-mail com segurança.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8;">
            © 2026 Elo 57. Todos os direitos reservados.
          </div>
        </div>
      `
    };

    console.log(`[Recuperar Senha Action] Enviando e-mail de recuperação para ${emailLimpo}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[Recuperar Senha Action] E-mail de recuperação enviado com sucesso.`);

    return { success: true };
  } catch (err) {
    console.error("[Recuperar Senha Action] Erro crítico:", err);
    return { error: 'Ocorreu um erro interno no servidor.' };
  }
}

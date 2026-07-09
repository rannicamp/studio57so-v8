import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cancelarAssinatura } from '@/lib/asaas';

// Como o webhook roda de forma assíncrona e externa, não há sessão de usuário.
// Nós usamos o cliente administrativo do Supabase com service_role para contornar o RLS e atualizar a tabela organizacoes.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const headers = request.headers;
        
        console.log('[Asaas Webhook] Evento recebido:', body.event);

        // Validação de segurança opcional via Token de Webhook do Asaas
        const webhookTokenLocal = process.env.ASAAS_WEBHOOK_TOKEN;
        const webhookTokenRecebido = headers.get('asaas-access-token');

        if (webhookTokenLocal && webhookTokenRecebido !== webhookTokenLocal) {
            console.warn('[Asaas Webhook] Token de validação inválido ou ausente.');
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }

        const { event, payment, subscription } = body;

        // Caso o evento seja disparado a nível de cobrança (fatura)
        if (payment) {
            const subscriptionId = payment.subscription || null;
            const orgIdFromRef = payment.externalReference ? Number(payment.externalReference) : null;
            
            // 1. Pagamento Recebido ou Confirmado
            if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
                console.log(`[Asaas Webhook] Pagamento confirmado. Fatura ID: ${payment.id}, OrgRef: ${orgIdFromRef}`);

                // Prorroga a validade da assinatura com base na periodicidade descrita na cobrança
                const desc = payment.description || '';
                const isSemestral = desc.toLowerCase().includes('semestral');
                const mesesVigencia = isSemestral ? 6 : 12;

                const dueDate = new Date(payment.dueDate);
                const expiresAt = new Date(dueDate);
                expiresAt.setMonth(expiresAt.getMonth() + mesesVigencia);
                expiresAt.setDate(expiresAt.getDate() + 3); // 3 dias de tolerância
                
                let query = supabaseAdmin.from('organizacoes').update({
                    subscription_status: 'active',
                    subscription_expires_at: expiresAt.toISOString()
                });

                if (orgIdFromRef) {
                    query = query.eq('id', orgIdFromRef);
                } else if (subscriptionId) {
                    query = query.eq('asaas_subscription_id', subscriptionId);
                } else {
                    console.warn('[Asaas Webhook] Falha ao identificar organização para ativação de pagamento.');
                    return NextResponse.json({ success: true });
                }

                const { error } = await query;
                if (error) {
                    console.error('[Asaas Webhook] Erro ao atualizar organização no banco:', error.message);
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                console.log(`[Asaas Webhook] Organização ativada. Expira em: ${expiresAt.toISOString()}`);
            }

            // 2. Pagamento Vencido (Atrasado)
            if (event === 'PAYMENT_OVERDUE') {
                console.warn(`[Asaas Webhook] Pagamento vencido para fatura: ${payment.id}`);

                let query = supabaseAdmin.from('organizacoes').update({
                    subscription_status: 'overdue'
                });

                if (orgIdFromRef) {
                    query = query.eq('id', orgIdFromRef);
                } else if (subscriptionId) {
                    query = query.eq('asaas_subscription_id', subscriptionId);
                } else {
                    console.warn('[Asaas Webhook] Falha ao identificar organização para registrar inadimplência.');
                    return NextResponse.json({ success: true });
                }

                const { error } = await query;
                if (error) {
                    console.error('[Asaas Webhook] Erro ao marcar inadimplência no banco:', error.message);
                }
            }
        }

        // Caso o evento seja a nível de assinatura (Subscription)
        if (event === 'SUB_DELETED' || event === 'SUB_CANCELED' || event === 'SUB_INACTIVATED') {
            const subId = subscription ? subscription.id : (body.subscriptionId || null);
            if (subId) {
                console.warn(`[Asaas Webhook] Assinatura cancelada no Asaas: ${subId}`);

                // Alteramos o status para canceled (cancelado) se não estiver ativada por outra via
                const { error } = await supabaseAdmin
                    .from('organizacoes')
                    .update({
                        subscription_status: 'canceled'
                    })
                    .eq('asaas_subscription_id', subId);

                if (error) {
                    console.error('[Asaas Webhook] Erro ao marcar assinatura cancelada no banco:', error.message);
                }
            }
        }

        // Registro do cartão no Asaas altera status de pending para trialing (desbloqueando o acesso)
        // E CANCELA a assinatura em seguida para evitar cobrança automática pós-trial (fase de garantia)
        if (event === 'SUB_UPDATED' || event === 'SUB_CREATED') {
            const subId = subscription ? subscription.id : (body.subscriptionId || null);
            if (subId && subscription && subscription.billingType === 'CREDIT_CARD') {
                console.log(`[Asaas Webhook] Assinatura de garantia criada com cartão no Asaas: ${subId}`);

                const updatePayload = {
                    subscription_status: 'trialing'
                };

                // Asaas retorna dados do cartão se tokenizado
                if (subscription.creditCard) {
                    updatePayload.card_brand = subscription.creditCard.creditCardBrand || null;
                    updatePayload.card_last_digits = subscription.creditCard.creditCardNumber || null;
                }

                const { error } = await supabaseAdmin
                    .from('organizacoes')
                    .update(updatePayload)
                    .eq('asaas_subscription_id', subId);

                if (error) {
                    console.error('[Asaas Webhook] Erro ao atualizar status de trial no banco:', error.message);
                } else {
                    console.log(`[Asaas Webhook] Assinatura ${subId} marcada como trialing (desbloqueada).`);
                    
                    // CANCELAR IMEDIATAMENTE A ASSINATURA NO ASAAS (Garantia registrada, cancela auto-debit)
                    try {
                        console.log(`[Asaas Webhook] Cancelando assinatura de garantia ${subId} para evitar cobranças automáticas...`);
                        await cancelarAssinatura(subId);
                    } catch (cancelError) {
                        console.warn(`[Asaas Webhook] Erro ao cancelar assinatura de garantia ${subId}:`, cancelError.message);
                    }
                }
            }
        }

        // 3. Emissão de Nota Fiscal Autorizada (NFS-e)
        if (event === 'INVOICE_AUTHORIZED') {
            const invoice = body.invoice;
            if (invoice && invoice.pdfUrl && invoice.status === 'AUTHORIZED') {
                console.log(`[Asaas Webhook] Nota Fiscal autorizada: ${invoice.id} para cliente ${invoice.customer}`);
                
                // Busca a organização a partir do asaas_customer_id
                const { data: org } = await supabaseAdmin
                    .from('organizacoes')
                    .select('id, nome')
                    .eq('asaas_customer_id', invoice.customer)
                    .maybeSingle();

                if (org) {
                    // Busca o e-mail do administrador do cadastro da empresa
                    const { data: empresa } = await supabaseAdmin
                        .from('cadastro_empresa')
                        .select('email, responsavel_legal')
                        .eq('organizacao_id', org.id)
                        .maybeSingle();

                    const emailDestino = empresa?.email || null;
                    if (emailDestino) {
                        console.log(`[Asaas Webhook] Enviando e-mail de Nota Fiscal para: ${emailDestino}`);
                        
                        // Busca configurações do elo57@studio57.arq.br
                        const { data: config } = await supabaseAdmin
                            .from('email_configuracoes')
                            .select('*')
                            .eq('email', 'elo57@studio57.arq.br')
                            .maybeSingle();

                        if (config) {
                            const nodemailer = require('nodemailer');
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
                                to: emailDestino,
                                subject: `Nota Fiscal Eletrônica (NFS-e) - Elo 57 - Faturamento de R$ ${Number(invoice.value).toFixed(2).replace('.', ',')}`,
                                html: `
                                  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #334155; background-color: #f8fafc; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                                    <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
                                      <img src="https://studio57.arq.br/marca/logo-elo57-horizontal.svg" alt="Elo 57" style="height: 32px; width: auto; border: none; display: inline-block; outline: none;" />
                                      <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Nota Fiscal de Serviços Eletrônica (NFS-e)</p>
                                    </div>

                                    <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                                      <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 700;">Olá, ${empresa.responsavel_legal || 'Administrador'},</h3>
                                      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                                        Confirmamos a homologação e emissão da sua **Nota Fiscal de Serviços Eletrônica (NFS-e)** referente à assinatura da plataforma **Elo 57**. O arquivo PDF original da nota também foi anexado a este e-mail.
                                      </p>

                                      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Prestador:</td>
                                          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">Studio 57 Arquitetura Integrada Ltda</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Serviço:</td>
                                          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">Licenciamento de Software ERP SaaS (Elo 57)</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Valor Faturado:</td>
                                          <td style="padding: 8px 0; color: #10b981; font-weight: 700; text-align: right; font-size: 15px;">R$ ${Number(invoice.value).toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                          <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Nota Fiscal ID:</td>
                                          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right;">${invoice.id}</td>
                                        </tr>
                                      </table>

                                      <div style="text-align: center; margin-top: 25px; margin-bottom: 10px;">
                                        <a href="${invoice.pdfUrl}" target="_blank" style="background-color: #000000; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                          Visualizar PDF da Nota Fiscal
                                        </a>
                                      </div>
                                    </div>

                                    <div style="text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                                      <p style="margin: 0 0 5px 0;">Este é um e-mail transacional automático enviado por elo57@studio57.arq.br.</p>
                                      <p style="margin: 0;">🔒 Transação processada via Asaas IP S.A.</p>
                                    </div>
                                  </div>
                                `,
                                attachments: [
                                    {
                                        filename: `NFS-e_Elo57_${invoice.number || invoice.id}.pdf`,
                                        path: invoice.pdfUrl
                                    }
                                ]
                            };

                            try {
                                await transporter.sendMail(mailOptions);
                                console.log(`[Asaas Webhook] E-mail de Nota Fiscal enviado com sucesso para ${emailDestino}`);
                            } catch (emailError) {
                                console.error(`[Asaas Webhook] Falha ao enviar e-mail de Nota Fiscal:`, emailError.message);
                            }
                        }
                    }
                }
            }
        }

        // Retornar HTTP 200 para confirmar recebimento ao Asaas
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Asaas Webhook] Erro no processamento do webhook:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
        if (event === 'SUB_DELETED' || event === 'SUB_CANCELED') {
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

        // Retornar HTTP 200 para confirmar recebimento ao Asaas
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Asaas Webhook] Erro no processamento do webhook:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

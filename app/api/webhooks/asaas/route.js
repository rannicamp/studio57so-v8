import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
        if (payment && payment.subscription) {
            const subscriptionId = payment.subscription;
            
            // 1. Pagamento Recebido ou Confirmado
            if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
                console.log(`[Asaas Webhook] Pagamento confirmado para assinatura: ${subscriptionId}`);

                // Prorroga a validade da assinatura para 30 dias a partir da data de vencimento da fatura paga,
                // mais uma tolerância de 3 dias extras (total 33 dias).
                const dueDate = new Date(payment.dueDate);
                const expiresAt = new Date(dueDate);
                expiresAt.setDate(expiresAt.getDate() + 33); // 30 dias de ciclo + 3 dias de tolerância
                
                const { data, error } = await supabaseAdmin
                    .from('organizacoes')
                    .update({
                        subscription_status: 'active',
                        subscription_expires_at: expiresAt.toISOString()
                    })
                    .eq('asaas_subscription_id', subscriptionId)
                    .select();

                if (error) {
                    console.error('[Asaas Webhook] Erro ao atualizar organização no banco:', error.message);
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                console.log(`[Asaas Webhook] Organização atualizada para ativa. Expira em: ${expiresAt.toISOString()}`);
            }

            // 2. Pagamento Vencido (Atrasado)
            if (event === 'PAYMENT_OVERDUE') {
                console.warn(`[Asaas Webhook] Pagamento vencido para assinatura: ${subscriptionId}`);

                // Alteramos o status para overdue (inadimplente)
                const { error } = await supabaseAdmin
                    .from('organizacoes')
                    .update({
                        subscription_status: 'overdue'
                    })
                    .eq('asaas_subscription_id', subscriptionId);

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

                // Alteramos o status para canceled (cancelado)
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

        // Retornar HTTP 200 para confirmar recebimento ao Asaas
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Asaas Webhook] Erro no processamento do webhook:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

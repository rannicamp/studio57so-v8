import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { obterDetalhesAssinatura, listarPagamentos } from '@/lib/asaas';

export async function GET(request) {
    const supabase = await createClient();

    try {
        // 1. Validar a sessão do usuário
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Não autorizado. Faça login para continuar.' }, { status: 401 });
        }

        // 2. Buscar o perfil para obter o organizacao_id
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (userError || !usuario || !usuario.organizacao_id) {
            return NextResponse.json({ error: 'Usuário não associado a nenhuma organização.' }, { status: 400 });
        }

        const orgId = usuario.organizacao_id;

        // 3. Buscar os dados da organização
        const { data: org, error: orgError } = await supabase
            .from('organizacoes')
            .select('nome, asaas_customer_id, asaas_subscription_id, subscription_status, subscription_expires_at, trial_ends_at, plano_codigo, cupom_aplicado')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Erro ao carregar dados da organização.' }, { status: 400 });
        }

        // Buscar dados cadastrais da empresa
        const { data: empresa } = await supabase
            .from('cadastro_empresa')
            .select('cnpj, cep, address_street, address_number, telefone, email, razao_social, city, state')
            .eq('organizacao_id', orgId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Resposta base se não houver integração com o Asaas ativa ainda
        const responseData = {
            organizacao: {
                nome: org.nome,
                status: org.subscription_status || 'trialing',
                expiresAt: org.subscription_expires_at,
                trialEndsAt: org.trial_ends_at,
                plano_codigo: org.plano_codigo,
                cupom_aplicado: org.cupom_aplicado
            },
            empresa: empresa || null,
            cartao: null,
            faturas: []
        };

        // 4. Se a organização tiver cliente e assinatura cadastrados no Asaas, buscar detalhes reais
        if (org.asaas_subscription_id && org.asaas_customer_id) {
            try {
                // Obter detalhes da assinatura (para pegar dados do cartão)
                const assinaturaAsaas = await obterDetalhesAssinatura(org.asaas_subscription_id);
                
                // Mapear dados do cartão se o tipo for cartão
                if (assinaturaAsaas.billingType === 'CREDIT_CARD' && assinaturaAsaas.creditCard) {
                    responseData.cartao = {
                        brand: assinaturaAsaas.creditCard.creditCardBrand || 'N/A',
                        lastDigits: (assinaturaAsaas.creditCard.creditCardNumber || '').slice(-4) || 'N/A'
                    };
                }

                // Obter histórico de faturas do cliente
                const faturasAsaas = await listarPagamentos(org.asaas_customer_id, 10);
                
                // Mapear faturas para um formato limpo
                responseData.faturas = faturasAsaas.map(f => ({
                    id: f.id,
                    value: f.value,
                    netValue: f.netValue,
                    dueDate: f.dueDate,
                    paymentDate: f.paymentDate || null,
                    status: f.status, // PENDING, RECEIVED, CONFIRMED, OVERDUE, etc.
                    billingType: f.billingType, // CREDIT_CARD, BOLETO, PIX
                    invoiceUrl: f.invoiceUrl, // Link para pagar/ver fatura
                    confirmedBillingUrl: f.confirmedBillingUrl || null // PDF do comprovante
                }));

                // Opcional: Atualizar status local com o do Asaas em caso de divergência
                const statusMapeado = assinaturaAsaas.status === 'ACTIVE' ? 'active' :
                                      assinaturaAsaas.status === 'OVERDUE' ? 'overdue' :
                                      ['INACTIVE', 'CANCELED'].includes(assinaturaAsaas.status) ? 'canceled' : org.subscription_status;
                
                if (statusMapeado !== org.subscription_status) {
                    console.log(`[Details API] Sincronizando status local (${org.subscription_status}) com Asaas (${statusMapeado})`);
                    await supabase
                        .from('organizacoes')
                        .update({ subscription_status: statusMapeado })
                        .eq('id', orgId);
                    responseData.organizacao.status = statusMapeado;
                }

            } catch (apiError) {
                console.error('[Details API] Erro ao integrar dados com o Asaas:', apiError.message);
                // Retorna os dados locais do Supabase em caso de erro da API do Asaas para não quebrar a tela
            }
        }

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('[Details API] Erro na rota:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

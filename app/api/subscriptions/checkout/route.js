import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { obterOuCriarCliente, criarAssinatura, obterLinkPagamentoAssinatura } from '@/lib/asaas';

const PLAN_VALUE = 297.00; // Valor mensal padrão da assinatura do Elo 57

export async function POST(request) {
    const supabase = await createClient();

    try {
        // 1. Validar a sessão do usuário logado
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Não autorizado. Faça login para continuar.' }, { status: 401 });
        }

        // 2. Buscar o perfil do usuário para obter o organizacao_id
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        if (userError || !usuario || !usuario.organizacao_id) {
            return NextResponse.json({ error: 'Usuário não associado a nenhuma organização.' }, { status: 400 });
        }

        const orgId = usuario.organizacao_id;

        // 3. Buscar informações da organização
        const { data: org, error: orgError } = await supabase
            .from('organizacoes')
            .select('nome, asaas_customer_id, trial_ends_at')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Erro ao carregar dados da organização.' }, { status: 400 });
        }

        let asaasCustomerId = org.asaas_customer_id;

        // 4. Obter ou Criar o cliente no Asaas
        if (!asaasCustomerId) {
            console.log(`[Checkout API] Organização ${org.nome} sem asaas_customer_id. Criando no Asaas...`);
            const customer = await obterOuCriarCliente({
                nome: org.nome,
                email: user.email,
                cpfCnpj: null // Pode ser preenchido pelo cliente na tela de checkout do Asaas
            });
            asaasCustomerId = customer.id;

            // Salvar o ID do cliente Asaas no banco
            const { error: updateError } = await supabase
                .from('organizacoes')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('id', orgId);

            if (updateError) {
                console.error('[Checkout API] Erro ao atualizar asaas_customer_id no banco:', updateError.message);
            }
        }

        // 5. Calcular a data de vencimento da primeira mensalidade
        // Se o trial ainda for válido no futuro, jogamos o primeiro vencimento para o fim do trial.
        // Caso contrário, o primeiro vencimento será amanhã (o Asaas exige que nextDueDate seja >= amanhã para assinaturas em cartão).
        const hoje = new Date();
        const amanha = new Date();
        amanha.setDate(hoje.getDate() + 1);
        const dataAmanhaStr = amanha.toISOString().split('T')[0];

        let valorPlano = PLAN_VALUE;
        let cicloPlano = 'MONTHLY';
        let descPlano = `Assinatura Elo 57 - Plano Mensal (${org.nome})`;
        let nextDueDate = dataAmanhaStr;

        if (org.trial_ends_at) {
            const dataTrial = new Date(org.trial_ends_at);
            if (dataTrial > amanha) {
                nextDueDate = dataTrial.toISOString().split('T')[0];
            }
        }

        // Teste promocional solicitado pelo "seu lindo" para a Org 2 (Studio 57)
        if (orgId === 2 || String(orgId) === '2') {
            console.log('[Checkout API] Aplicando promoção de teste de R$ 12,00 Anual para a Org 2');
            valorPlano = 12.00;
            cicloPlano = 'ANNUAL';
            descPlano = `Assinatura Elo 57 - Plano Promocional Anual (${org.nome})`;
            nextDueDate = dataAmanhaStr; // Força vencimento para amanhã para permitir o débito de teste imediato!
        }

        console.log(`[Checkout API] Primeiro vencimento agendado para: ${nextDueDate}`);

        // 6. Criar a assinatura (recorrência) no Asaas
        const assinatura = await criarAssinatura({
            clienteId: asaasCustomerId,
            valor: valorPlano,
            ciclo: cicloPlano,
            descricao: descPlano,
            dataVencimento: nextDueDate,
            formaPagamento: 'UNDEFINED'
        });

        // 7. Atualizar a organização com o ID da assinatura e status de trialing (se no trial) ou active
        const { error: updateSubError } = await supabase
            .from('organizacoes')
            .update({
                asaas_subscription_id: assinatura.id,
                subscription_status: 'trialing' // O webhook vai atualizar para 'active' assim que o pagamento compensar
            })
            .eq('id', orgId);

        if (updateSubError) {
            console.error('[Checkout API] Erro ao atualizar asaas_subscription_id no banco:', updateSubError.message);
        }

        // 8. Obter a URL da primeira fatura de pagamento da assinatura
        const checkoutUrl = await obterLinkPagamentoAssinatura(assinatura.id);

        return NextResponse.json({ checkoutUrl });

    } catch (error) {
        console.error('[Checkout API] Erro no fluxo de checkout:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

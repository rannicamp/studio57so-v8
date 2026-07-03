import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { obterOuCriarCliente, criarAssinatura, obterLinkPagamentoAssinatura, cancelarAssinatura } from '@/lib/asaas';

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
            .select('nome, asaas_customer_id, trial_ends_at, asaas_subscription_id')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Erro ao carregar dados da organização.' }, { status: 400 });
        }

        // 4. Ler dados enviados no POST body (plano_codigo e cupom)
        const body = await request.json().catch(() => ({}));
        const planoCodigo = body.plano_codigo || 'essencial';
        const cupom = body.cupom || '';

        // 5. Buscar plano e cupom no banco
        const { data: planoRecord, error: planoQueryError } = await supabase
            .from('planos')
            .select('*')
            .eq('codigo', planoCodigo)
            .single();

        if (planoQueryError || !planoRecord) {
            return NextResponse.json({ error: 'Plano selecionado inválido ou não cadastrado.' }, { status: 400 });
        }

        let trialDays = 15;
        let descontoPercentual = 0.00;
        let cupomAplicado = null;

        if (cupom) {
            const { data: promocaoRecord } = await supabase
                .from('promocoes')
                .select('*')
                .eq('codigo', cupom.toUpperCase().trim())
                .eq('ativo', true)
                .maybeSingle();

            if (promocaoRecord) {
                trialDays = promocaoRecord.trial_days || 15;
                descontoPercentual = Number(promocaoRecord.desconto_percentual) || 0.00;
                cupomAplicado = promocaoRecord.codigo;
            }
        }

        // 6. Cancelar assinatura anterior se existir no Asaas para evitar duplicidade de cobrança
        if (org.asaas_subscription_id) {
            try {
                console.log(`[Checkout API] Cancelando assinatura anterior do cliente: ${org.asaas_subscription_id}`);
                await cancelarAssinatura(org.asaas_subscription_id);
            } catch (cancelError) {
                console.warn('[Checkout API] Erro ao cancelar assinatura anterior (pode já estar cancelada):', cancelError.message);
            }
        }

        let asaasCustomerId = org.asaas_customer_id;

        // 7. Buscar dados cadastrais da empresa local para enviar ao Asaas
        console.log(`[Checkout API] Buscando dados cadastrais da empresa para a Org ${orgId}...`);
        const { data: empresa } = await supabase
            .from('cadastro_empresa')
            .select('cnpj, cep, address_number, telefone, email, razao_social')
            .eq('organizacao_id', orgId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const dadosCadastro = {
            nome: empresa?.razao_social || org.nome,
            email: empresa?.email || user.email,
            cpfCnpj: empresa?.cnpj ? empresa.cnpj.replace(/\D/g, '') : null,
            phone: empresa?.telefone ? empresa.telefone.replace(/\D/g, '') : null,
            postalCode: empresa?.cep ? empresa.cep.replace(/\D/g, '') : null,
            addressNumber: empresa?.address_number || 'S/N'
        };

        // Exige CPF ou CNPJ de faturamento
        if (!dadosCadastro.cpfCnpj) {
            return NextResponse.json({ 
                error: 'Falta CPF ou CNPJ de faturamento. Preencha o CNPJ no cadastro da sua empresa em Configurações antes de assinar.' 
            }, { status: 400 });
        }

        console.log(`[Checkout API] Sincronizando cliente no Asaas...`);
        const customer = await obterOuCriarCliente(dadosCadastro);
        asaasCustomerId = customer.id;

        // Se o asaas_customer_id local estava vazio ou for diferente, atualiza no banco
        if (org.asaas_customer_id !== asaasCustomerId) {
            console.log(`[Checkout API] Gravando novo asaas_customer_id no banco: ${asaasCustomerId}`);
            const { error: updateError } = await supabase
                .from('organizacoes')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('id', orgId);

            if (updateError) {
                console.error('[Checkout API] Erro ao atualizar asaas_customer_id no banco:', updateError.message);
            }
        }

        // 8. Calcular data de vencimento da primeira mensalidade (hoje + trialDays)
        const dataVenc = new Date();
        dataVenc.setDate(dataVenc.getDate() + trialDays);
        const dataVencimentoStr = dataVenc.toISOString().split('T')[0];

        let valorPlano = planoRecord.valor_mensal;
        let valorLiquido = Number((valorPlano * (1 - descontoPercentual / 100)).toFixed(2));
        let cicloPlano = 'MONTHLY';
        let descPlano = `Assinatura Elo 57 - Plano ${planoRecord.nome} (${org.nome})`;

        // Teste promocional solicitado pelo "seu lindo" para a Org 2 (Studio 57) se não houver cupom específico
        if (!cupom && (orgId === 2 || String(orgId) === '2')) {
            console.log('[Checkout API] Aplicando promoção de teste de R$ 12,00 Anual para a Org 2');
            valorLiquido = 12.00;
            cicloPlano = 'YEARLY';
            descPlano = `Assinatura Elo 57 - Plano Promocional Anual (${org.nome})`;
        }

        console.log(`[Checkout API] Primeiro vencimento agendado para: ${dataVencimentoStr}`);

        // 9. Criar a assinatura (recorrência) no Asaas
        const assinatura = await criarAssinatura({
            clienteId: asaasCustomerId,
            valor: valorLiquido,
            ciclo: cicloPlano,
            descricao: descPlano,
            dataVencimento: dataVencimentoStr,
            formaPagamento: cupomAplicado ? 'CREDIT_CARD' : 'UNDEFINED'
        });

        // 10. Atualizar a organização com a assinatura e vencimentos
        const { error: updateSubError } = await supabase
            .from('organizacoes')
            .update({
                asaas_subscription_id: assinatura.id,
                plano_codigo: planoCodigo,
                cupom_aplicado: cupomAplicado,
                subscription_status: 'pending', // trava novamente até preencher cartão no checkout
                trial_ends_at: dataVenc.toISOString(),
                subscription_expires_at: dataVenc.toISOString()
            })
            .eq('id', orgId);

        if (updateSubError) {
            console.error('[Checkout API] Erro ao atualizar asaas_subscription_id no banco:', updateSubError.message);
        }

        // 11. Obter a URL da primeira fatura de pagamento da assinatura
        const checkoutUrl = await obterLinkPagamentoAssinatura(assinatura.id);

        return NextResponse.json({ checkoutUrl });

    } catch (error) {
        console.error('[Checkout API] Erro no fluxo de checkout:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

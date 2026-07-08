import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { obterOuCriarCliente, criarAssinatura, obterLinkPagamentoAssinatura, cancelarAssinatura, criarPagamento } from '@/lib/asaas';

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

        // 4. Ler dados enviados no POST body (plano_codigo, cupom, periodicidade)
        const body = await request.json().catch(() => ({}));
        const planoCodigo = body.plano_codigo || 'essencial';
        const cupom = body.cupom || '';
        const periodicidade = body.periodicidade || 'anual'; // 'semestral' ou 'anual'
        const parcelas = body.parcelas ? Number(body.parcelas) : null;

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

        // 6. Cancelar assinatura/cobrança anterior se existir no Asaas para evitar duplicidade de cobrança
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
            .order('created_at', { ascending: false})
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

        if (!dadosCadastro.cpfCnpj) {
            return NextResponse.json({ 
                error: 'Falta CPF ou CNPJ de faturamento. Preencha o CNPJ no cadastro da sua empresa em Configurações antes de assinar.' 
            }, { status: 400 });
        }

        console.log(`[Checkout API] Sincronizando cliente no Asaas...`);
        const customer = await obterOuCriarCliente(dadosCadastro);
        asaasCustomerId = customer.id;

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

        // 8. Calcular data de vencimento da primeira parcela ou carência (hoje + trialDays)
        const dataVenc = new Date();
        dataVenc.setDate(dataVenc.getDate() + trialDays);
        const dataVencimentoStr = dataVenc.toISOString().split('T')[0];

        console.log(`[Checkout API] Primeiro vencimento agendado para: ${dataVencimentoStr}`);

        let checkoutUrl = '';

        if (cupomAplicado) {
            // FLUXO DE GARANTIA (Com Cupom): Criamos uma assinatura temporária de R$ 297/mês (ou correspondente)
            // com vencimento daqui a 90 dias. No webhook, salvaremos os dados do cartão e a cancelaremos na hora.
            let valorPlano = planoRecord.valor_mensal;
            let valorLiquido = Number((valorPlano * (1 - descontoPercentual / 100)).toFixed(2));
            let descPlano = `Garantia Elo 57 - Plano ${planoRecord.nome} (${org.nome})`;

            console.log(`[Checkout API] Criando assinatura de garantia no Asaas no valor de R$ ${valorLiquido}...`);
            const assinatura = await criarAssinatura({
                clienteId: asaasCustomerId,
                valor: valorLiquido,
                ciclo: 'MONTHLY',
                descricao: descPlano,
                dataVencimento: dataVencimentoStr,
                formaPagamento: 'CREDIT_CARD'
            });

            // Atualizar a organização no Supabase
            const { error: updateSubError } = await supabase
                .from('organizacoes')
                .update({
                    asaas_subscription_id: assinatura.id,
                    plano_codigo: planoCodigo,
                    cupom_aplicado: cupomAplicado,
                    subscription_status: 'pending',
                    trial_ends_at: dataVenc.toISOString(),
                    subscription_expires_at: dataVenc.toISOString() // durante o trial, expira ao fim dele
                })
                .eq('id', orgId);

            if (updateSubError) {
                console.error('[Checkout API] Erro ao atualizar asaas_subscription_id no banco:', updateSubError.message);
            }

            checkoutUrl = await obterLinkPagamentoAssinatura(assinatura.id);

        } else {
            // FLUXO DE PAGAMENTO IMEDIATO/EFETIVO (Sem Cupom ou Pós-Trial): Criamos uma cobrança parcelada única
            const meses = periodicidade === 'semestral' ? 6 : 12;
            const parcelasMax = periodicidade === 'semestral' ? 3 : 6;
            const parcelasFinal = (parcelas && parcelas >= 1 && parcelas <= parcelasMax) ? parcelas : parcelasMax;
            const valorMensal = Number(planoRecord.valor_mensal);
            const valorTotal = valorMensal * meses;
            
            const valorTotalComDesconto = Number((valorTotal * (1 - descontoPercentual / 100)).toFixed(2));
            const descPlano = `Plano Elo 57 - ${planoRecord.nome} ${periodicidade === 'semestral' ? 'Semestral' : 'Anual'} (${org.nome})`;

            console.log(`[Checkout API] Criando cobrança parcelada de R$ ${valorTotalComDesconto} em ${parcelasFinal}x no Asaas...`);
            const pagamento = await criarPagamento({
                clienteId: asaasCustomerId,
                valor: valorTotalComDesconto,
                formaPagamento: 'UNDEFINED', // PIX, Boleto ou Cartão
                dataVencimento: dataVencimentoStr,
                descricao: descPlano,
                parcelas: parcelasFinal,
                externalReference: orgId
            });

            const dataExpira = new Date(dataVenc);
            dataExpira.setMonth(dataExpira.getMonth() + meses);

            // Atualizar a organização no Supabase
            const { error: updateSubError } = await supabase
                .from('organizacoes')
                .update({
                    asaas_subscription_id: pagamento.id, // salvamos o ID do pagamento/grupo
                    plano_codigo: planoCodigo,
                    cupom_aplicado: cupomAplicado,
                    subscription_status: 'pending',
                    trial_ends_at: dataVenc.toISOString(),
                    subscription_expires_at: dataExpira.toISOString() // vigência completa ativada de antemão
                })
                .eq('id', orgId);

            if (updateSubError) {
                console.error('[Checkout API] Erro ao atualizar faturamento no banco:', updateSubError.message);
            }

            checkoutUrl = pagamento.invoiceUrl;
        }

        return NextResponse.json({ checkoutUrl });

    } catch (error) {
        console.error('[Checkout API] Erro no fluxo de checkout:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

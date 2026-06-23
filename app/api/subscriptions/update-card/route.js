import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { atualizarCartaoAssinatura, tokenizarCartao, obterOuCriarCliente } from '@/lib/asaas';

export async function POST(request) {
    const supabase = await createClient();

    try {
        // 1. Validar a sessão do usuário
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

        // 3. Buscar os dados da organização (ids do Asaas)
        const { data: org, error: orgError } = await supabase
            .from('organizacoes')
            .select('nome, asaas_subscription_id, asaas_customer_id')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Erro ao carregar dados da organização.' }, { status: 400 });
        }

        // 4. Garantir que a organização tenha um asaas_customer_id
        let asaasCustomerId = org.asaas_customer_id;
        if (!asaasCustomerId) {
            console.log(`[Update Card API] Organização ${org.nome} sem asaas_customer_id. Criando cliente no Asaas...`);
            const customer = await obterOuCriarCliente({
                nome: org.nome,
                email: user.email,
                cpfCnpj: null
            });
            asaasCustomerId = customer.id;

            // Grava o ID do cliente criado no banco
            await supabase
                .from('organizacoes')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('id', orgId);
        }

        // 5. Ler os dados do novo cartão do corpo do POST
        const body = await request.json();
        const { holderName, number, expiryMonth, expiryYear, ccv } = body;

        if (!holderName || !number || !expiryMonth || !expiryYear || !ccv) {
            return NextResponse.json({ error: 'Todos os campos do cartão são obrigatórios.' }, { status: 400 });
        }

        // 6. Obter dados cadastrais fiscais do Asaas (ou fallback local) para o creditCardHolderInfo
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
        const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
        
        let customer = { cpfCnpj: null, postalCode: null, addressNumber: null, email: user.email };
        try {
            console.log(`[Update Card API] Buscando dados cadastrais do cliente no Asaas: ${asaasCustomerId}`);
            const customerResponse = await fetch(`${ASAAS_API_URL}/customers/${asaasCustomerId}`, {
                headers: {
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            if (customerResponse.ok) {
                customer = await customerResponse.json();
            }
        } catch (err) {
            console.warn('[Update Card API] Não foi possível buscar o cliente no Asaas. Usando fallbacks locais.', err.message);
        }

        // Configurar fallbacks para os dados do titular se faltar algo no cadastro do Asaas
        let cpfCnpj = customer.cpfCnpj;
        let postalCode = customer.postalCode;
        let addressNumber = customer.addressNumber;
        let email = customer.email || user.email;
        let phone = customer.mobilePhone || customer.phone || '33999999999';

        if (!cpfCnpj || !postalCode) {
            console.log('[Update Card API] Dados cadastrais incompletos no Asaas. Buscando fallback local...');
            const { data: empresa } = await supabase
                .from('cadastro_empresa')
                .select('cnpj, cep, address_number, telefone, email')
                .eq('organizacao_id', orgId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (empresa) {
                cpfCnpj = cpfCnpj || empresa.cnpj;
                postalCode = postalCode || (empresa.cep ? empresa.cep.replace(/\D/g, '') : null);
                addressNumber = addressNumber || empresa.address_number;
                email = email || empresa.email;
                phone = phone || empresa.telefone;
            }
        }

        // Validação final de dados fiscais necessários
        if (!cpfCnpj) {
            return NextResponse.json({ 
                error: 'Falta CPF ou CNPJ de faturamento. Preencha o cadastro da sua empresa antes de cadastrar o cartão.' 
            }, { status: 400 });
        }
        if (!postalCode) {
            return NextResponse.json({ 
                error: 'Falta o CEP de faturamento. Preencha o CEP da empresa antes de cadastrar o cartão.' 
            }, { status: 400 });
        }

        const creditCard = {
            holderName,
            number: number.replace(/\s+/g, ''),
            expiryMonth,
            expiryYear,
            ccv
        };

        const creditCardHolderInfo = {
            name: holderName,
            email,
            cpfCnpj: cpfCnpj.replace(/\D/g, ''),
            postalCode: postalCode.replace(/\D/g, ''),
            addressNumber: addressNumber || 'S/N',
            phone: phone ? phone.replace(/\D/g, '') : undefined
        };

        // 7. Salvar ou Tokenizar dependendo de possuir assinatura recorrente ou não
        if (org.asaas_subscription_id) {
            // Cenário A: Possui assinatura recorrente -> atualiza cartão na recorrência
            const responseAsaas = await atualizarCartaoAssinatura(org.asaas_subscription_id, {
                creditCard,
                creditCardHolderInfo
            });

            // Gravar a bandeira e final do cartão no banco local para espelhamento rápido da UI
            const cardBrand = responseAsaas.creditCard?.creditCardBrand || 'N/A';
            const cardLastDigits = (responseAsaas.creditCard?.creditCardNumber || '').slice(-4) || 'N/A';

            await supabase
                .from('organizacoes')
                .update({
                    card_brand: cardBrand,
                    card_last_digits: cardLastDigits
                })
                .eq('id', orgId);

            console.log(`[Update Card API] Cartão atualizado e salvo localmente para assinatura recorrente.`);
        } else {
            // Cenário B: Não possui assinatura recorrente (ex: vitalícia ou apenas quer salvar o cartão avulso)
            // Tokenizar o cartão diretamente no cliente no Asaas
            const responseAsaas = await tokenizarCartao(asaasCustomerId, {
                creditCard,
                creditCardHolderInfo
            });

            const cardToken = responseAsaas.creditCardToken;
            const cardBrand = responseAsaas.creditCardBrand || 'N/A';
            const cardLastDigits = (responseAsaas.creditCardNumber || '').slice(-4) || 'N/A';

            // Salva o token do cartão, bandeira e últimos 4 dígitos no banco de dados do Elo 57
            await supabase
                .from('organizacoes')
                .update({
                    asaas_card_token: cardToken,
                    card_brand: cardBrand,
                    card_last_digits: cardLastDigits
                })
                .eq('id', orgId);

            console.log(`[Update Card API] Cartão tokenizado de forma avulsa e salvo localmente.`);
        }

        // 8. Responder sucesso (nenhum dado de cartão de crédito permanece em memória após isso)
        return NextResponse.json({ success: true, message: 'Cartão de crédito cadastrado com sucesso!' });

    } catch (error) {
        console.error('[Update Card API] Erro na rota de atualização de cartão:', error.message);
        let msg = error.message;
        if (msg.includes('403') || msg.toLowerCase().includes('permissão') || msg.toLowerCase().includes('gerente')) {
            msg = 'Habilitação Pendente no Asaas: A tokenização direta de cartão via API exige autorização da equipe do Asaas. Solicite a liberação da Tokenização de Cartão ao suporte do Asaas ou utilize o checkout seguro para cadastrar seu cartão.';
        }
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

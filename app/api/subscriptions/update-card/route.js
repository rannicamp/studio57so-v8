import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { atualizarCartaoAssinatura } from '@/lib/asaas';

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

        if (orgError || !org || !org.asaas_subscription_id) {
            return NextResponse.json({ error: 'Sua organização não possui uma assinatura ativa para atualizar.' }, { status: 400 });
        }

        // 4. Ler os dados do novo cartão do corpo do POST
        const body = await request.json();
        const { holderName, number, expiryMonth, expiryYear, ccv } = body;

        if (!holderName || !number || !expiryMonth || !expiryYear || !ccv) {
            return NextResponse.json({ error: 'Todos os campos do cartão são obrigatórios.' }, { status: 400 });
        }

        // 5. Obter dados do cliente no Asaas para usar como dados fiscais do titular (creditCardHolderInfo)
        // Isso evita que precisemos exigir que o cliente digite CPF, CEP, etc., de novo.
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
        const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
        
        console.log(`[Update Card API] Buscando dados cadastrais do cliente no Asaas: ${org.asaas_customer_id}`);
        const customerResponse = await fetch(`${ASAAS_API_URL}/customers/${org.asaas_customer_id}`, {
            headers: {
                'access_token': ASAAS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!customerResponse.ok) {
            throw new Error('Falha ao obter os dados do cliente no Asaas para validação.');
        }

        const customer = await customerResponse.json();

        // 6. Configurar fallbacks para os dados do titular se faltar algo no cadastro do Asaas
        // Buscamos dados locais da empresa se os dados no Asaas estiverem nulos
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

        // Se após o fallback ainda faltar CPF/CNPJ ou CEP (cenário raro de assinatura manual/teste incompleta),
        // nós geramos um erro solicitando que ele utilize o checkout do Asaas ou cadastre os dados nas configurações
        if (!cpfCnpj) {
            return NextResponse.json({ 
                error: 'Falta CPF ou CNPJ de faturamento. Preencha o cadastro da sua empresa antes de atualizar o cartão.' 
            }, { status: 400 });
        }
        if (!postalCode) {
            return NextResponse.json({ 
                error: 'Falta o CEP de faturamento. Preencha o CEP da empresa antes de atualizar o cartão.' 
            }, { status: 400 });
        }

        const creditCard = {
            holderName,
            number: number.replace(/\s+/g, ''), // remove espaços
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

        // 7. Chamar o Asaas para realizar a atualização segura da assinatura
        await atualizarCartaoAssinatura(org.asaas_subscription_id, {
            creditCard,
            creditCardHolderInfo
        });

        // 8. Responder sucesso (nenhum dado de cartão de crédito permanece em memória após isso)
        return NextResponse.json({ success: true, message: 'Cartão de crédito atualizado com sucesso!' });

    } catch (error) {
        console.error('[Update Card API] Erro na rota de atualização de cartão:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Utilitário de integração com a API v3 do Asaas
 * Referência: https://docs.asaas.com/
 */

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Helper para fazer requisições à API do Asaas
async function asaasFetch(endpoint, options = {}) {
    console.log(`[Asaas Fetch Debug] Chamando endpoint: ${endpoint}. Chave presente: ${!!ASAAS_API_KEY}, Tamanho: ${ASAAS_API_KEY ? ASAAS_API_KEY.length : 0}`);
    if (!ASAAS_API_KEY) {
        throw new Error('Chave de API do Asaas (ASAAS_API_KEY) não configurada no .env.local.');
    }

    const url = `${ASAAS_API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
        ...options.headers
    };

    const config = {
        ...options,
        headers
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
        const errorMsg = data.errors ? data.errors.map(e => e.description).join(', ') : 'Erro desconhecido na API do Asaas';
        throw new Error(`Asaas API Error [${response.status}]: ${errorMsg}`);
    }

    return data;
}

/**
 * Cria ou busca um cliente no Asaas pelo e-mail
 */
export async function obterOuCriarCliente({ nome, email, cpfCnpj, phone, postalCode, addressNumber }) {
    try {
        // 1. Tentar buscar cliente existente pelo e-mail para evitar duplicados
        console.log(`[Asaas] Buscando cliente com email: ${email}`);
        const busca = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`);
        
        if (busca.data && busca.data.length > 0) {
            const clienteExistente = busca.data[0];
            console.log(`[Asaas] Cliente encontrado: ${clienteExistente.id}. Atualizando dados cadastrais no Asaas...`);
            
            // Atualizar o cadastro do cliente no Asaas para garantir que possua o CPF/CNPJ e dados atualizados
            const clienteAtualizado = await asaasFetch(`/customers/${clienteExistente.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: nome,
                    email: email,
                    cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
                    phone: phone ? phone.replace(/\D/g, '') : undefined,
                    postalCode: postalCode ? postalCode.replace(/\D/g, '') : undefined,
                    addressNumber: addressNumber || undefined
                })
            });

            return clienteAtualizado;
        }

        // 2. Se não existir, criar novo cliente
        console.log(`[Asaas] Cliente não encontrado. Criando novo cliente: ${nome}`);
        const novoCliente = await asaasFetch('/customers', {
            method: 'POST',
            body: JSON.stringify({
                name: nome,
                email: email,
                cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
                phone: phone ? phone.replace(/\D/g, '') : undefined,
                postalCode: postalCode ? postalCode.replace(/\D/g, '') : undefined,
                addressNumber: addressNumber || undefined
            })
        });

        console.log(`[Asaas] Cliente criado com sucesso: ${novoCliente.id}`);
        return novoCliente;
    } catch (error) {
        console.error('[Asaas] Erro em obterOuCriarCliente:', error.message);
        throw error;
    }
}

/**
 * Cria uma assinatura (recorrência) para um cliente
 */
export async function criarAssinatura({ clienteId, valor, ciclo = 'MONTHLY', descricao, dataVencimento, formaPagamento = 'UNDEFINED', maxPayments }) {
    try {
        console.log(`[Asaas] Criando assinatura para cliente ${clienteId} no valor de R$ ${valor} com tipo ${formaPagamento}`);
        
        // Define o primeiro vencimento. Se não for especificado, usamos hoje + 1 dia (Asaas exige que o vencimento seja no futuro)
        let nextDueDate = dataVencimento;
        if (!nextDueDate) {
            const data = new Date();
            data.setDate(data.getDate() + 1); // amanhã
            nextDueDate = data.toISOString().split('T')[0];
        }

        const payload = {
            customer: clienteId,
            billingType: formaPagamento,
            value: valor,
            nextDueDate,
            cycle: ciclo, // MONTHLY, SEMIANNUAL, ANNUAL, etc.
            description: descricao || 'Assinatura Elo 57'
        };

        if (maxPayments) {
            payload.maxPayments = Number(maxPayments);
        }

        const assinatura = await asaasFetch('/subscriptions', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        console.log(`[Asaas] Assinatura criada com sucesso: ${assinatura.id}`);
        return assinatura;
    } catch (error) {
        console.error('[Asaas] Erro em criarAssinatura:', error.message);
        throw error;
    }
}

/**
 * Busca a primeira cobrança pendente de uma assinatura e retorna a URL de checkout (invoiceUrl)
 */
export async function obterLinkPagamentoAssinatura(assinaturaId) {
    try {
        console.log(`[Asaas] Buscando cobranças da assinatura: ${assinaturaId}`);
        // Endpoint para listar cobranças associadas a uma assinatura específica
        const cobrancas = await asaasFetch(`/payments?subscription=${assinaturaId}`);
        
        if (cobrancas.data && cobrancas.data.length > 0) {
            // Filtrar pelas cobranças pendentes (PENDING)
            const pendente = cobrancas.data.find(c => c.status === 'PENDING') || cobrancas.data[0];
            console.log(`[Asaas] Cobrança ativa encontrada: ${pendente.id}. URL de pagamento: ${pendente.invoiceUrl}`);
            return pendente.invoiceUrl;
        }

        throw new Error('Nenhuma cobrança ativa/pendente encontrada para esta assinatura.');
    } catch (error) {
        console.error('[Asaas] Erro em obterLinkPagamentoAssinatura:', error.message);
        throw error;
    }
}

/**
 * Recupera os detalhes de uma assinatura específica no Asaas
 */
export async function obterDetalhesAssinatura(assinaturaId) {
    try {
        console.log(`[Asaas] Buscando detalhes da assinatura: ${assinaturaId}`);
        const assinatura = await asaasFetch(`/subscriptions/${assinaturaId}`);
        return assinatura;
    } catch (error) {
        console.error('[Asaas] Erro em obterDetalhesAssinatura:', error.message);
        throw error;
    }
}

/**
 * Recupera a lista de pagamentos/faturas de um cliente específico
 */
export async function listarPagamentos(clienteId, limite = 10) {
    try {
        console.log(`[Asaas] Buscando últimas ${limite} cobranças do cliente: ${clienteId}`);
        const cobrancas = await asaasFetch(`/payments?customer=${clienteId}&limit=${limite}`);
        return cobrancas.data || [];
    } catch (error) {
        console.error('[Asaas] Erro em listarPagamentos:', error.message);
        throw error;
    }
}

/**
 * Atualiza o cartão de crédito e dados do titular associados a uma assinatura ativa
 */
export async function atualizarCartaoAssinatura(assinaturaId, { creditCard, creditCardHolderInfo, remoteIp }) {
    try {
        console.log(`[Asaas] Atualizando dados de cartão para assinatura: ${assinaturaId} (IP: ${remoteIp})`);
        const response = await asaasFetch(`/subscriptions/${assinaturaId}/creditCard`, {
            method: 'PUT',
            body: JSON.stringify({
                creditCard,
                creditCardHolderInfo,
                remoteIp
            })
        });
        console.log(`[Asaas] Cartão atualizado com sucesso para assinatura: ${assinaturaId}`);
        return response;
    } catch (error) {
        console.error('[Asaas] Erro em atualizarCartaoAssinatura:', error.message);
        throw error;
    }
}

/**
 * Tokeniza um cartão de crédito no Asaas para um cliente específico (sem vinculá-lo a uma assinatura recorrente)
 */
export async function tokenizarCartao(clienteId, { creditCard, creditCardHolderInfo }) {
    try {
        console.log(`[Asaas] Tokenizando cartão para o cliente: ${clienteId}`);
        const response = await asaasFetch('/creditCard/tokenize', {
            method: 'POST',
            body: JSON.stringify({
                customer: clienteId,
                creditCard,
                creditCardHolderInfo
            })
        });
        console.log(`[Asaas] Cartão tokenizado com sucesso para o cliente: ${clienteId}`);
        return response;
    } catch (error) {
        console.error('[Asaas] Erro em tokenizarCartao:', error.message);
        throw error;
    }
}

/**
 * Cancela uma assinatura ativa no Asaas
 */
export async function cancelarAssinatura(assinaturaId) {
    try {
        console.log(`[Asaas] Cancelando assinatura: ${assinaturaId}`);
        const response = await asaasFetch(`/subscriptions/${assinaturaId}`, {
            method: 'DELETE'
        });
        console.log(`[Asaas] Assinatura cancelada com sucesso: ${assinaturaId}`);
        return response;
    } catch (error) {
        console.error('[Asaas] Erro em cancelarAssinatura:', error.message);
        throw error;
    }
}

/**
 * Cria uma cobrança única ou parcelada no Asaas
 */
export async function criarPagamento({ clienteId, valor, formaPagamento = 'UNDEFINED', dataVencimento, descricao, parcelas, externalReference }) {
    try {
        console.log(`[Asaas] Criando cobrança para cliente ${clienteId} no valor total de R$ ${valor} com tipo ${formaPagamento}`);
        
        const payload = {
            customer: clienteId,
            billingType: formaPagamento,
            dueDate: dataVencimento,
            description: descricao || 'Plano Elo 57',
            externalReference: externalReference ? String(externalReference) : undefined
        };

        if (parcelas && Number(parcelas) > 1) {
            payload.value = valor; // valor total da compra
            payload.installmentCount = Number(parcelas); // quantidade de parcelas
        } else {
            payload.value = valor;
        }

        const pagamento = await asaasFetch('/payments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        console.log(`[Asaas] Cobrança criada com sucesso: ${pagamento.id}. Link de checkout: ${pagamento.invoiceUrl}`);
        return pagamento;
    } catch (error) {
        console.error('[Asaas] Erro em criarPagamento:', error.message);
        throw error;
    }
}



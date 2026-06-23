/**
 * Utilitário de integração com a API v3 do Asaas
 * Referência: https://docs.asaas.com/
 */

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Helper para fazer requisições à API do Asaas
async function asaasFetch(endpoint, options = {}) {
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
export async function obterOuCriarCliente({ nome, email, cpfCnpj }) {
    try {
        // 1. Tentar buscar cliente existente pelo e-mail para evitar duplicados
        console.log(`[Asaas] Buscando cliente com email: ${email}`);
        const busca = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`);
        
        if (busca.data && busca.data.length > 0) {
            console.log(`[Asaas] Cliente encontrado: ${busca.data[0].id}`);
            return busca.data[0];
        }

        // 2. Se não existir, criar novo cliente
        console.log(`[Asaas] Cliente não encontrado. Criando novo cliente: ${nome}`);
        const novoCliente = await asaasFetch('/customers', {
            method: 'POST',
            body: JSON.stringify({
                name: nome,
                email: email,
                cpfCnpj: cpfCnpj || undefined
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
export async function criarAssinatura({ clienteId, valor, ciclo = 'MONTHLY', descricao, dataVencimento }) {
    try {
        console.log(`[Asaas] Criando assinatura para cliente ${clienteId} no valor de R$ ${valor}`);
        
        // Define o primeiro vencimento. Se não for especificado, usamos hoje + 1 dia (Asaas exige que o vencimento seja no futuro)
        let nextDueDate = dataVencimento;
        if (!nextDueDate) {
            const data = new Date();
            data.setDate(data.getDate() + 1); // amanhã
            nextDueDate = data.toISOString().split('T')[0];
        }

        const assinatura = await asaasFetch('/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
                customer: clienteId,
                billingType: 'CREDIT_CARD', // Cartão de crédito como padrão
                value: valor,
                nextDueDate,
                cycle: ciclo, // MONTHLY, SEMIANNUAL, ANNUAL, etc.
                description: descricao || 'Assinatura Elo 57'
            })
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
export async function atualizarCartaoAssinatura(assinaturaId, { creditCard, creditCardHolderInfo }) {
    try {
        console.log(`[Asaas] Atualizando dados de cartão para assinatura: ${assinaturaId}`);
        const response = await asaasFetch(`/subscriptions/${assinaturaId}`, {
            method: 'POST', // Asaas utiliza POST para alteração parcial/atualização de dados de assinatura
            body: JSON.stringify({
                creditCard,
                creditCardHolderInfo
            })
        });
        console.log(`[Asaas] Cartão atualizado com sucesso para assinatura: ${assinaturaId}`);
        return response;
    } catch (error) {
        console.error('[Asaas] Erro em atualizarCartaoAssinatura:', error.message);
        throw error;
    }
}


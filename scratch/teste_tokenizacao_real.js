const { loadEnvConfig } = require('@next/env');
const path = require('path');

// Carrega as variáveis de ambiente como o Next.js faz
const projectDir = path.join(__dirname, '..');
loadEnvConfig(projectDir);

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

async function asaasFetch(endpoint, options = {}) {
    if (!ASAAS_API_KEY) {
        throw new Error('Chave de API do Asaas (ASAAS_API_KEY) não configurada.');
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

async function obterOuCriarCliente({ nome, email, cpfCnpj }) {
    console.log(`[Asaas] Buscando cliente com email: ${email}`);
    const busca = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`);
    
    if (busca.data && busca.data.length > 0) {
        console.log(`[Asaas] Cliente encontrado: ${busca.data[0].id}`);
        return busca.data[0];
    }

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
}

async function tokenizarCartao(clienteId, { creditCard, creditCardHolderInfo }) {
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
}

async function run() {
    console.log('--- TESTE DE TOKENIZAÇÃO REAL NO ASAAS (COMMONJS) ---');
    console.log('Chave de API presente:', !!ASAAS_API_KEY);
    console.log('Tamanho da chave:', ASAAS_API_KEY ? ASAAS_API_KEY.length : 0);
    if (ASAAS_API_KEY) {
        console.log('Primeiros 10 caracteres:', ASAAS_API_KEY.substring(0, 10));
    }

    try {
        // 1. Criar ou buscar o cliente
        console.log('\n1. Criando ou buscando cliente de teste...');
        const cliente = await obterOuCriarCliente({
            nome: 'STUDIO 57 - TESTE DE CONEXÃO',
            email: 'rannierecampos@studio57.arq.br',
            cpfCnpj: '46383617000100'
        });
        console.log('Sucesso ao obter cliente! ID:', cliente.id);

        // 2. Tentar tokenizar um cartão fictício
        console.log('\n2. Tentando tokenizar cartão fictício...');
        const dadosCartao = {
            creditCard: {
                holderName: 'Ranniere Campos',
                number: '4000111122223333', // Número fictício
                expiryMonth: '12',
                expiryYear: '2030',
                ccv: '123'
            },
            creditCardHolderInfo: {
                name: 'Ranniere Campos',
                email: 'rannierecampos@studio57.arq.br',
                cpfCnpj: '46383617000100',
                postalCode: '35162235',
                addressNumber: '100',
                phone: '33999999999'
            }
        };

        const response = await tokenizarCartao(cliente.id, dadosCartao);
        console.log('Sucesso! Cartão tokenizado:', response);

    } catch (error) {
        console.error('\n❌ Ocorreu um erro no teste:');
        console.error(error.message);
    }
}

run();

const fs = require('fs');
const path = require('path');

// Função simples para carregar .env.local de forma manual
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('Arquivo .env.local não encontrado!');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] || '';
            // Remove aspas simples ou duplas ao redor do valor
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            }
            if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
                value = value.substring(1, value.length - 1);
            }
            env[key] = value;
        }
    });
    return env;
}

async function run() {
    const env = loadEnv();
    const apiKey = env.ASAAS_API_KEY;
    const apiUrl = env.ASAAS_API_URL || 'https://api.asaas.com/v3';

    console.log('--- TESTE DE CONEXÃO COM A API DO ASAAS ---');
    console.log(`URL do Asaas: ${apiUrl}`);
    console.log(`API Key (primeiros 15 caracteres): ${apiKey ? apiKey.substring(0, 15) + '...' : 'NÃO CONFIGURADA'}`);

    if (!apiKey) {
        console.error('Erro: ASAAS_API_KEY não encontrada no .env.local');
        process.exit(1);
    }

    try {
        const url = `${apiUrl}/customers?limit=1`;
        console.log(`Realizando requisição GET para: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': apiKey
            }
        });

        console.log(`Status HTTP: ${response.status} (${response.statusText})`);
        
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }

        if (response.ok) {
            console.log('Sucesso! Conexão realizada com a API do Asaas.');
            console.log('Estrutura de dados retornada (amostra):', JSON.stringify(data, null, 2).substring(0, 500) + '\n...');
        } else {
            console.error('A API do Asaas retornou um erro:', data);
        }
    } catch (error) {
        console.error('Erro ao conectar na API do Asaas:', error);
    }
}

run();

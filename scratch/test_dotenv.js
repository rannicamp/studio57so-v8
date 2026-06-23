const { loadEnvConfig } = require('@next/env');
const path = require('path');

async function test() {
    const projectDir = path.join(__dirname, '..');
    console.log('Carregando variáveis do Next.js para o diretório:', projectDir);
    
    // Carrega as variáveis exatamente como o Next.js faz
    loadEnvConfig(projectDir);

    console.log('--- RESULTADO DO CARREGAMENTO DO NEXT.JS ---');
    console.log('process.env.ASAAS_API_URL:', process.env.ASAAS_API_URL);
    console.log('process.env.ASAAS_API_KEY:', process.env.ASAAS_API_KEY);
    console.log('Tamanho da API Key carregada:', process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.length : 0);
    if (process.env.ASAAS_API_KEY) {
        console.log('Primeiros 15 caracteres:', process.env.ASAAS_API_KEY.substring(0, 15));
    }
}

test();

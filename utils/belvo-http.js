import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

// Configurações da Política de Retry (Conforme Documentação OFDA)
const RETRY_BASE_DELAY = 3000;
const RETRY_FACTOR = 2;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cliente HTTP Pura da Belvo (Sem SDK)
 * Resolve o erro: "Client is not a constructor"
 */
export async function belvoRequest(endpoint, options = {}) {
    // 1. Recuperar Credenciais do Banco
    const supabase = await createClient();
    const organizacaoId = await getOrganizationId();
    
    const { data: config, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error || !config) throw new Error('Credenciais Belvo não encontradas no Supabase.');

    // 2. Definir Ambiente
    const baseUrl = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    // 3. Preparar Autenticação (Basic Auth)
    // O segredo está em montar o header manualmente
    const authString = Buffer.from(`${config.secret_id}:${config.secret_password}`).toString('base64');
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
        ...options.headers
    };

    // 4. Loop de Requisição com Retry
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES) {
        try {
            const url = `${baseUrl}${endpoint}`;
            
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            const responseData = await response.json().catch(() => ({}));

            if (response.ok) {
                return responseData;
            }

            // Tratamento de Erros conforme Documentação
            if (response.status === 428) throw new Error("MFA_REQUIRED");

            // Se for erro 5xx ou Too Many Sessions, tenta de novo
            const isRetryable = response.status >= 500 || responseData.code === 'too_many_sessions';
            
            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt);
                await sleep(delay);
                attempt++;
                continue;
            }

            throw new Error(responseData.message || `Erro Belvo (${response.status})`);

        } catch (err) {
            if (attempt === MAX_RETRIES) throw err;
            await sleep(RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt));
            attempt++;
        }
    }
}
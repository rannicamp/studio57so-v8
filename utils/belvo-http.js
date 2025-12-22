import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

const RETRY_BASE_DELAY = 3000; 
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Faz requisições à Belvo usando Fetch Puro.
 * Implementa política de repetição automática para erros 5xx e limites de sessão.
 */
export async function belvoRequest(endpoint, options = {}) {
    const supabase = await createClient();
    const organizacaoId = await getOrganizationId();
    
    const { data: config, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error || !config) throw new Error('Configurações Belvo não encontradas no Supabase.');

    const baseUrl = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    const authString = Buffer.from(`${config.secret_id}:${config.secret_password}`).toString('base64');
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
        ...options.headers
    };

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
        try {
            const url = `${baseUrl}${endpoint}`;
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            // Captura o texto bruto para evitar o erro "Unexpected token '<'"
            const responseText = await response.text();
            
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                console.error("❌ Resposta não é JSON (Provável HTML de erro):", responseText.substring(0, 150));
                throw new Error("A Belvo retornou um formato inválido (HTML). Verifique se a URL e o Ambiente estão corretos.");
            }

            if (response.ok) return responseData;

            // Lógica de Repetição (Retry) conforme documentação
            const isRetryable = response.status >= 500 || responseData.code === 'too_many_sessions';
            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
                console.warn(`⏳ Erro ${response.status}. Retentando em ${delay/1000}s...`);
                await sleep(delay);
                attempt++;
                continue;
            }

            throw new Error(responseData[0]?.message || responseData.message || `Erro Belvo (${response.status})`);

        } catch (err) {
            if (attempt === MAX_RETRIES) throw err;
            await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
            attempt++;
        }
    }
}
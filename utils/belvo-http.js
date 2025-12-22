import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

// Configurações da Política de Retry (Conforme Documentação Oficial da Belvo)
const RETRY_BASE_DELAY = 3000; // 3 segundos
const RETRY_FACTOR = 2;        // Multiplicador (Exponencial)
const MAX_RETRIES = 5;         // Limite de tentativas

/**
 * Função utilitária para esperar um determinado tempo
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * belvoRequest: Cliente HTTP robusto para a API da Belvo.
 * * Resolve:
 * 1. Erro de SDK (Constructor error) ao usar Fetch nativo.
 * 2. Erro de JSON inválido ao validar se a resposta é HTML antes de converter.
 * 3. Instabilidade com lógica de Retry Policy (Backoff Exponencial).
 */
export async function belvoRequest(endpoint, options = {}) {
    // 1. Recuperar Credenciais dinamicamente do Supabase
    const supabase = await createClient();
    const organizacaoId = await getOrganizationId();
    
    const { data: config, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error || !config) {
        throw new Error('Configurações da Belvo não encontradas no banco de dados para esta organização.');
    }

    // 2. Definir URL Base e Autenticação
    const baseUrl = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    // Cria o Header de autorização Basic Auth (Secret ID : Secret Password)
    const authString = Buffer.from(`${config.secret_id}:${config.secret_password}`).toString('base64');
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
        ...options.headers // Permite passar headers extras como X-Belvo-API-Resource-Version
    };

    let attempt = 0;
    
    // 3. Loop de Execução com Retry
    while (attempt <= MAX_RETRIES) {
        try {
            const url = `${baseUrl}${endpoint}`;
            
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            // Captura a resposta como texto primeiro para evitar erro de parse no HTML
            const responseText = await response.text();
            
            let responseData;
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                // Se cair aqui, o servidor devolveu HTML (Erro de rota ou servidor fora do ar)
                console.error("❌ Resposta da Belvo não é um JSON válido (HTML recebido):", responseText.substring(0, 200));
                throw new Error("A API retornou um formato inválido (HTML). Verifique se a URL e o ambiente (Sandbox/Prod) estão configurados corretamente.");
            }

            // --- TRATAMENTO DE STATUS HTTP ---

            if (response.ok) {
                return responseData; // Sucesso (200, 201)
            }

            // ERRO 428: MFA Necessário (O banco exige Token/SMS)
            if (response.status === 428) {
                throw new Error("MFA_REQUIRED");
            }

            // ERROS 5xx ou "Too Many Sessions" (40x específico) -> Aciona Política de Retry
            const isRetryable = response.status >= 500 || responseData.code === 'too_many_sessions' || (Array.isArray(responseData) && responseData[0]?.code === 'too_many_sessions');
            
            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt);
                console.warn(`⚠️ Erro ${response.status} na Belvo. Tentativa ${attempt + 1}. Retentando em ${delay/1000}s...`);
                await sleep(delay);
                attempt++;
                continue; // Volta para o início do loop e tenta novamente
            }

            // ERROS 4xx Comuns (Não retentáveis)
            const errorMessage = Array.isArray(responseData) 
                ? responseData[0]?.message 
                : (responseData.message || `Erro Belvo (${response.status})`);
                
            throw new Error(errorMessage);

        } catch (err) {
            // Se o erro for MFA_REQUIRED ou já tivermos esgotado as tentativas, lançamos para o front
            if (err.message === "MFA_REQUIRED" || attempt === MAX_RETRIES) {
                throw err;
            }

            // Erros de rede genéricos também sofrem retry
            const delay = RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt);
            await sleep(delay);
            attempt++;
        }
    }
}
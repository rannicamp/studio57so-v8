import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

const RETRY_BASE_DELAY = 3000;
const RETRY_FACTOR = 2;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function belvoRequest(endpoint, options = {}) {
    const supabase = await createClient();
    const organizacaoId = await getOrganizationId();
    
    // 1. Busca as chaves no banco
    const { data: config, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error || !config) {
        throw new Error('Configurações da Belvo não encontradas no Supabase, seu lindo.');
    }

    // 2. Define a URL base (Garante que não tenha barra sobrando)
    const baseUrl = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    const authString = Buffer.from(`${config.secret_id}:${config.secret_password}`).toString('base64');
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
        'X-Belvo-API-Resource-Version': '2022-06-01',
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

            // --- AQUI ESTÁ O PULO DO GATO ---
            // Lemos como texto primeiro para evitar o erro do "token <"
            const responseText = await response.text();
            let responseData;

            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                // Se cair aqui, a Belvo devolveu um HTML (erro de servidor ou rota)
                console.error("⚠️ Resposta não-JSON da Belvo:", responseText);
                throw new Error("A Belvo devolveu um erro de servidor (HTML). Verifique se suas chaves no Supabase estão corretas.");
            }

            if (response.ok) return responseData;

            // Tratamento de erros específicos da API
            if (response.status === 401) {
                throw new Error("Chaves da Belvo Inválidas! Verifique o Secret ID e Password no seu painel de configurações.");
            }

            if (response.status === 428) throw new Error("MFA_REQUIRED");

            const isRetryable = response.status >= 500 || responseData.code === 'too_many_sessions';
            
            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt);
                await sleep(delay);
                attempt++;
                continue;
            }

            const errorMessage = Array.isArray(responseData) 
                ? responseData[0]?.message 
                : (responseData.message || `Erro Belvo (${response.status})`);
                
            throw new Error(errorMessage);

        } catch (err) {
            if (err.message.includes("MFA_REQUIRED") || attempt === MAX_RETRIES) throw err;
            const delay = RETRY_BASE_DELAY * Math.pow(RETRY_FACTOR, attempt);
            await sleep(delay);
            attempt++;
        }
    }
}
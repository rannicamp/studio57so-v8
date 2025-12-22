import belvo from 'belvo'; // <--- IMPORTAÇÃO CORRETA (Sem chaves)
import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

// Cache do cliente para não recriar a cada requisição (Singleton pattern)
let belvoClientInstance = null;

export const getBelvoClient = async () => {
    // 1. Busca organização e configurações no banco
    const supabase = await createClient();
    const organizacaoId = await getOrganizationId();

    if (!organizacaoId) {
        throw new Error('Organização não identificada para configurar Belvo.');
    }

    const { data: config, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error || !config) {
        throw new Error('Configurações da Belvo não encontradas. Vá em Configurações > Integrações.');
    }

    // 2. Define a URL base dependendo do ambiente
    // Sandbox: https://sandbox.belvo.com
    // Production: https://api.belvo.com
    const url = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    // 3. Inicializa o Cliente Belvo
    // AQUI ESTAVA O ERRO: Usamos 'belvo.Client' vindo do import default
    try {
        const client = new belvo.Client(
            config.secret_id,
            config.secret_password,
            url
        );

        // Opcional: Faz um login inicial para validar (a biblioteca faz isso auto, mas garante erro rápido se falhar)
        await client.connect();

        return { client, organizacaoId };
    } catch (err) {
        console.error("Erro ao inicializar SDK da Belvo:", err);
        throw new Error(`Falha na conexão com Belvo: ${err.message}`);
    }
};
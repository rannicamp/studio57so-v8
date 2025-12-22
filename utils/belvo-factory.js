import { createClient } from './supabase/server';
import { getOrganizationId } from './getOrganizationId';

// NOTA: Removemos o 'import' estático do topo para evitar erro de build.
// Vamos carregar a biblioteca dinamicamente dentro da função.

export const getBelvoClient = async () => {
    // 1. CARREGAMENTO ROBUSTO DA BIBLIOTECA
    // O Next.js as vezes empacota bibliotecas antigas de forma diferente.
    // Aqui garantimos que vamos pegar a classe certa, não importa como ela venha.
    const belvoModule = require('belvo');
    
    let BelvoClient;

    // Tenta achar o construtor Client em diferentes lugares
    if (typeof belvoModule.Client === 'function') {
        BelvoClient = belvoModule.Client;
    } else if (belvoModule.default && typeof belvoModule.default.Client === 'function') {
        BelvoClient = belvoModule.default.Client;
    } else {
        // Se falhar, loga para debug e tenta usar o próprio módulo
        console.error("Estrutura do módulo Belvo:", belvoModule);
        BelvoClient = belvoModule; 
    }

    // Última verificação de segurança
    if (typeof BelvoClient !== 'function') {
        throw new Error("Falha crítica: A biblioteca 'belvo' não exportou um construtor Client válido.");
    }

    // 2. BUSCA CONFIGURAÇÕES NO BANCO
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
        throw new Error('Configurações da Belvo não encontradas no banco de dados.');
    }

    // 3. DEFINE URL
    const url = config.environment === 'production' 
        ? 'https://api.belvo.com' 
        : 'https://sandbox.belvo.com';

    // 4. INSTANCIA O CLIENTE
    try {
        const client = new BelvoClient(
            config.secret_id,
            config.secret_password,
            url
        );

        // Faz um login inicial para validar as credenciais imediatamente
        await client.connect();

        return { client, organizacaoId };
    } catch (err) {
        console.error("Erro ao inicializar SDK da Belvo:", err);
        // Retorna erro amigável se for credencial errada
        if (err.statusCode === 401) {
            throw new Error("Credenciais da Belvo inválidas (Erro 401). Verifique Secret ID e Password.");
        }
        throw new Error(`Falha na conexão com Belvo: ${err.message}`);
    }
};
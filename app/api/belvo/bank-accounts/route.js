import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { getOrganizationId } from '../../../../utils/getOrganizationId';

export async function POST(request) {
    try {
        console.log("🏦 [BELVO BANK] Registrando conta bancária...");

        // 1. Pega os dados que o Front-end mandou (Nome, Agência, Conta...)
        const body = await request.json();

        // 2. Busca as credenciais da Belvo no seu Banco de Dados
        const supabase = await createClient();
        const organizacaoId = await getOrganizationId();

        if (!organizacaoId) throw new Error('Organização não identificada.');

        const { data: config, error } = await supabase
            .from('configuracoes_belvo')
            .select('*')
            .eq('organizacao_id', organizacaoId)
            .single();

        if (error || !config) throw new Error('Configurações da Belvo não encontradas.');

        // 3. Define a URL (Sandbox ou Produção)
        const baseUrl = config.environment === 'production' 
            ? 'https://api.belvo.com' 
            : 'https://sandbox.belvo.com';
        
        // 4. Cria o cabeçalho de Autenticação (Basic Auth) manualmente
        // Isso substitui a necessidade da SDK que estava dando erro
        const authString = Buffer.from(`${config.secret_id}:${config.secret_password}`).toString('base64');

        // 5. Faz a chamada para a Belvo (usando o código que você mandou)
        const response = await fetch(`${baseUrl}/payments/br/bank-accounts/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Belvo-API-Resource-Version': 'Payments-BR.V2', // Importante para Pagamentos!
                'Authorization': `Basic ${authString}`
            },
            body: JSON.stringify(body) // Repassa os dados que vieram do front
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro Belvo API:", data);
            throw new Error(JSON.stringify(data));
        }

        console.log("✅ Conta bancária registrada na Belvo:", data.id);
        
        // Retorna o sucesso para o front
        return NextResponse.json(data);

    } catch (error) {
        console.error('Erro ao criar conta bancária Belvo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
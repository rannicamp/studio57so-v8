import { createClient } from './supabase/server';
import Belvo from 'belvo';
import { getOrganizationId } from './getOrganizationId';

export async function getBelvoClient() {
    const supabase = await createClient();
    
    // 1. Pega o usuário logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error('Usuário não autenticado.');
    }

    // 2. Descobre a organização dele
    const organizacaoId = await getOrganizationId(user.id);
    if (!organizacaoId) {
        throw new Error('Organização não encontrada.');
    }

    // 3. Busca as credenciais da Belvo no banco
    const { data: config, error: dbError } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (dbError || !config) {
        throw new Error('Configurações da Belvo não encontradas para esta organização. Vá em Configurações > Integrações.');
    }

    // 4. Inicializa o cliente da Belvo
    const client = new Belvo.Client(
        config.secret_id,
        config.secret_password,
        config.environment || 'sandbox' // 'sandbox', 'development' ou 'production'
    );

    return { client, organizacaoId };
}
// app/(main)/comercial/tabela-de-vendas/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import TabelaVendasGeral from '../../../../components/comercial/TabelaVendasGeral';
// IMPORTANTE: Header removido para evitar duplicação com o Layout.js

export default async function TabelaDeVendasPage() {
    const supabase = await createClient();

    // 1. Pega o usuário
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // 2. Busca organização
    const { data: userProfile } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();
    
    const organizacaoId = userProfile?.organizacao_id;
    if (!organizacaoId) {
        return <div className="p-6 text-red-500">Erro: Organização não identificada.</div>;
    }

    // 3. Busca Produtos
    const { data: products, error } = await supabase
        .from('produtos_empreendimento') 
        .select(`
            *,
            empreendimentos ( nome )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('unidade', { ascending: true });

    if (error) {
        return <div className="p-6 text-red-500">Erro ao carregar dados: {error.message}</div>;
    }

    return (
        // Removemos o <Header> e <main> daqui, pois o layout pai já fornece isso.
        <div className="max-w-full mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Tabela de Vendas Geral</h1>
            
            <TabelaVendasGeral 
                initialProdutos={products || []} 
                uiStateKey="tabela-vendas-geral-filtros-v1" // <--- CHAVE MÁGICA PARA PERSISTÊNCIA
            />
        </div>
    );
}
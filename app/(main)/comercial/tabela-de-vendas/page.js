// app/(main)/comercial/tabela-de-vendas/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import TabelaVendasGeral from '../../../../components/comercial/TabelaVendasGeral';

export default async function TabelaDeVendasPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: userProfile } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();
    
    const organizacaoId = userProfile?.organizacao_id;
    if (!organizacaoId) return <div className="p-6 text-red-500">Erro: Organização não identificada.</div>;

    const { data: products, error } = await supabase
        .from('produtos_empreendimento') 
        .select(`
            *,
            empreendimentos ( nome )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('unidade', { ascending: true });

    if (error) return <div className="p-6 text-red-500">Erro: {error.message}</div>;

    return (
        <div className="max-w-full mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Tabela de Vendas Geral</h1>
            
            <TabelaVendasGeral 
                initialProdutos={products || []} 
                uiStateKey="tabela-vendas-geral-filtros-v1" 
            />
        </div>
    );
}
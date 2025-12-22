// app/(main)/comercial/tabela-de-vendas/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import TabelaVendasGeral from '../../../../components/comercial/TabelaVendasGeral';
import Header from '../../../../components/Header';

export default async function TabelaDeVendasPage() {
    // CORREÇÃO: Adicionado 'await' aqui
    const supabase = await createClient();

    // 1. Pega o usuário da sessão
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // 2. Busca o perfil do usuário para encontrar o ID da organização
    const { data: userProfile } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();
    
    const organizacaoId = userProfile?.organizacao_id;
    
    // 3. Valida se encontrou a organização
    if (!organizacaoId) {
        return (
            <div className="p-4 text-red-500">
                Erro: Organização do usuário não encontrada. Verifique o cadastro do usuário.
            </div>
        );
    }

    const { data: products, error } = await supabase
        .from('produtos_empreendimento') 
        .select(`
            *,
            empreendimentos (
                nome
            )
        `)
        .eq('organizacao_id', organizacaoId)
        .order('unidade', { ascending: true });

    // 5. Se a busca falhar, mostra a mensagem
    if (error) {
        console.error('Erro ao buscar produtos para a tabela de vendas:', error.message);
        return <p className="p-4 text-red-500">Não foi possível carregar os produtos. Verifique o console para mais detalhes.</p>;
    }

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
                <div className="max-w-full mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Tabela de Vendas Geral</h1>
                    <TabelaVendasGeral initialProdutos={products || []} />
                </div>
            </main>
        </div>
    );
}
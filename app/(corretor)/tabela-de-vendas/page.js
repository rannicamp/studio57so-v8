// app/(corretor)/tabela-de-vendas/page.js
'use client'

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// 1. Importamos o mesmo componente da tabela principal
// (Ajuste o caminho se o seu estiver diferente)
import TabelaVendasGeral from '@/components/comercial/TabelaVendasGeral';

// 2. Função de busca de dados PARA O CORRETOR
async function fetchTabelaVendas(organizacaoId) {
  if (!organizacaoId) {
    return [];
  }
  
  const supabase = createClient();
  
  // 3. A Query Mágica com o Filtro
  // Usamos !inner para garantir que o empreendimento exista
  // E filtramos por 'listado_para_venda' = true
  const { data, error } = await supabase
    .from('produtos_empreendimento')
    .select(`
      *,
      empreendimentos!inner (
        nome
      )
    `)
    .eq('organizacao_id', organizacaoId)
    .eq('empreendimentos.listado_para_venda', true) // <-- O FILTRO MÁGICO!
    .order('unidade', { ascending: true });

  if (error) {
    console.error('Erro ao buscar produtos para o corretor:', error.message);
    throw new Error(error.message);
  }

  return data;
}

// 4. Componente da Página (Versão 'use client')
export default function TabelaVendasCorretor() {
  
  // Pega o usuário do nosso LayoutContext
  const { user, isUserLoading } = useLayout();
  const organizacaoId = user?.organizacao_id;

  const {
    data: produtos,
    isLoading: isLoadingProdutos,
    isError,
    error,
  } = useQuery({
    queryKey: ['tabelaVendasCorretor', organizacaoId],
    queryFn: () => fetchTabelaVendas(organizacaoId),
    enabled: !!organizacaoId, // Só executa a query quando o ID da organização estiver disponível
  });

  // Define o estado de "carregando" principal
  const isLoading = isUserLoading || isLoadingProdutos;

  // 5. Renderização (Loading, Erro, Sucesso)
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FontAwesomeIcon
          icon={faSpinner}
          className="text-blue-500 text-4xl"
          spin
        />
        <p className="ml-4 text-gray-600">Carregando tabela de vendas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Erro!</strong>
        <span className="block sm:inline"> {error.message}</span>
      </div>
    );
  }

  // 6. Sucesso: Renderiza o mesmo componente da página principal
  return (
    <div className="max-w-full mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tabela de Vendas</h1>
      <TabelaVendasGeral initialProdutos={produtos || []} />
    </div>
  );
}
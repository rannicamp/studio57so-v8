// app/(corretor)/tabela-de-vendas/page.js
'use client'

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import TabelaVendasGeral from '@/components/comercial/TabelaVendasGeral';

// Define a chave única para salvar o estado desta página específica
const CORRETOR_TABELA_UI_KEY = 'STUDIO57_CORRETOR_TABELA_VENDAS_V1';

async function fetchTabelaVendas(organizacaoId) {
  if (!organizacaoId) {
    return [];
  }
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('produtos_empreendimento')
    .select(`
      *,
      empreendimentos!inner (
        nome
      )
    `)
    .eq('organizacao_id', organizacaoId)
    .eq('empreendimentos.listado_para_venda', true)
    .order('unidade', { ascending: true });

  if (error) {
    console.error('Erro ao buscar produtos para o corretor:', error.message);
    throw new Error(error.message);
  }

  return data;
}

export default function TabelaVendasCorretor() {
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
    enabled: !!organizacaoId,
  });

  const isLoading = isUserLoading || isLoadingProdutos;

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

  return (
    <div className="max-w-full mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tabela de Vendas</h1>
      {/* Passamos a chave de persistência aqui! 
          Assim o componente sabe onde salvar/ler os filtros.
      */}
      <TabelaVendasGeral 
        initialProdutos={produtos || []} 
        uiStateKey={CORRETOR_TABELA_UI_KEY}
      />
    </div>
  );
}
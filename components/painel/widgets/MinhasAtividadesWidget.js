// components/painel/widgets/MinhasAtividadesWidget.js
// CÓDIGO CORRIGIDO - Removidos comentários inválidos do JSX

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
// Trocamos o cliente antigo pelo novo (o mesmo do FolhaPonto.js)
import { createClient } from '../../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTasks } from '@fortawesome/free-solid-svg-icons';
import AtividadeCard from './AtividadeCard';
import Link from 'next/link';

// Função de busca de dados
async function fetchMinhasAtividades(funcionario_id) {
  // Usamos o novo cliente Supabase (createClient)
  const supabase = createClient();
  const { data, error } = await supabase
    .from('activities')
    .select(`
      id,
      nome,
      data_fim_prevista,
      status,
      empreendimentos ( nome )
    `)
    .eq('funcionario_id', funcionario_id)
    .not('status', 'eq', 'Concluído') // Não mostrar atividades concluídas
    .order('data_fim_prevista', { ascending: true, nullsFirst: false })
    .limit(10);

  if (error) {
    console.error('Erro ao buscar atividades:', error);
    throw new Error('Não foi possível carregar as atividades.');
  }
  return data;
}

export default function MinhasAtividadesWidget({ funcionario_id }) {
  const { data: atividades, isLoading, error } = useQuery({
    queryKey: ['minhasAtividades', funcionario_id],
    queryFn: () => fetchMinhasAtividades(funcionario_id),
    enabled: !!funcionario_id, // Só executa a query se o funcionario_id existir
  });

  // Removemos o 'h-full' para que o widget se ajuste à altura
  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Minhas Atividades Pendentes</h3>
        <Link href="/atividades">
          <span className="text-sm text-blue-600 hover:underline">Ver todas</span>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-32">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
          <span className="ml-2 text-gray-500">Carregando...</span>
        </div>
      )}

      {error && (
        <div className="text-center text-red-500">{error.message}</div>
      )}

      {!isLoading && !error && atividades?.length > 0 && (
        <div className="flex flex-col space-y-2 max-h-80 overflow-y-auto pr-2">
          {atividades.map(at => (
            <AtividadeCard key={at.id} atividade={at} />
          ))}
        </div>
      )}

      {!isLoading && !error && atividades?.length === 0 && (
        <div className="flex flex-col justify-center items-center h-32 text-gray-400">
          <FontAwesomeIcon icon={faTasks} className="text-3xl mb-2" />
          <span className="text-sm">Nenhuma atividade pendente.</span>
        </div>
      )}
    </div>
  );
}
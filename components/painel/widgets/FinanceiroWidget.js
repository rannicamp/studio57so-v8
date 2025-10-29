// components/painel/widgets/FinanceiroWidget.js
// CÓDIGO COMPLETO

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileInvoiceDollar } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O PORQUÊ: Este widget busca dados financeiros relevantes (Contas a Pagar Hoje).
// Ele usa useQuery e só será mostrado se o usuário tiver a permissão "financeiro_pode_ver".

// Função de busca de dados
async function fetchResumoFinanceiro() {
  const supabase = createClientComponentClient();
  const hoje = format(new Date(), 'yyyy-MM-dd');
  
  const { data, error } = await supabase
    .from('lancamentos')
    .select('descricao, valor')
    .eq('tipo', 'Despesa')
    .eq('status', 'Pendente')
    .eq('data_vencimento', hoje)
    .order('valor', { ascending: false });

  if (error) {
    console.error('Erro ao buscar resumo financeiro:', error);
    throw new Error('Não foi possível carregar o resumo financeiro.');
  }
  return data;
}

export default function FinanceiroWidget() {
  const { data: lancamentos, isLoading, error } = useQuery({
    queryKey: ['resumoFinanceiroPainel'],
    queryFn: fetchResumoFinanceiro,
  });

  const total = lancamentos?.reduce((acc, l) => acc + l.valor, 0) || 0;

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Financeiro (Hoje)</h3>
      {isLoading ? (
        <div className="flex justify-center items-center h-24">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500">{error.message}</div>
      ) : (
        <div>
          <div className="mb-4">
            <span className="text-sm text-gray-500">Total a Pagar Hoje</span>
            <p className="text-3xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
            </p>
          </div>
          {lancamentos.length > 0 ? (
            <p className="text-sm text-gray-600">{lancamentos.length} conta(s) vence(m) hoje.</p>
          ) : (
             <p className="text-sm text-gray-500">Nenhuma conta a pagar hoje.</p>
          )}
        </div>
      )}
    </div>
  );
}
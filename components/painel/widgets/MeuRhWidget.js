// components/painel/widgets/MeuRhWidget.js
// CÓDIGO COMPLETO

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faClock, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

// O PORQUÊ: Este é o widget de KPIs de RH.
// Ele usa useQuery para buscar o saldo de banco de horas mais recente.
// IMPORTANTE: Como comentei, calcular "Horas Trabalhadas no Mês" lendo a tabela
// 'pontos' inteira é lento e complexo. O ideal é criar uma Função (RPC) no
// Supabase chamada 'get_horas_trabalhadas_mes_atual(funcionario_id)'.
// Por agora, implementei o Banco de Horas e deixei um "TODO" para as Horas Trabalhadas.

// Função de busca de dados
async function fetchResumoRh(funcionario_id) {
  const supabase = createClientComponentClient();
  const { data, error } = await supabase
    .from('banco_de_horas')
    .select('saldo_minutos')
    .eq('funcionario_id', funcionario_id)
    .order('mes_referencia', { ascending: false }) // Pega o mais recente
    .limit(1)
    .single(); // Espera apenas um resultado

  if (error && error.code !== 'PGRST116') { // Ignora erro "nenhuma linha encontrada"
    console.error('Erro ao buscar banco de horas:', error);
    throw new Error('Não foi possível carregar o resumo de RH.');
  }
  return data;
}

// Helper para formatar os minutos (ex: 125 minutos -> "2h 05m")
const formatarMinutos = (minutos) => {
  if (minutos === null || minutos === undefined) return 'N/A';
  const isNegativo = minutos < 0;
  const absMinutos = Math.abs(minutos);
  const horas = Math.floor(absMinutos / 60);
  const mins = absMinutos % 60;
  return `${isNegativo ? '-' : ''}${horas}h ${mins.toString().padStart(2, '0')}m`;
};

export default function MeuRhWidget({ funcionario_id }) {
  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ['meuRhResumo', funcionario_id],
    queryFn: () => fetchResumoRh(funcionario_id),
    enabled: !!funcionario_id,
  });

  const saldoFormatado = formatarMinutos(resumo?.saldo_minutos);
  const saldoColor = (resumo?.saldo_minutos || 0) < 0 ? 'text-red-500' : 'text-green-600';

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Meu Resumo RH</h3>
        <Link href="/recursos-humanos">
          <span className="text-sm text-blue-600 hover:underline">Detalhes</span>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-24">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
        </div>
      )}

      {error && (
        <div className="text-center text-red-500">{error.message}</div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-2 gap-4">
          {/* KPI Banco de Horas */}
          <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
            <FontAwesomeIcon icon={faClock} className="text-2xl text-blue-500 mb-2" />
            <span className="text-xs text-gray-500 uppercase font-medium">Banco de Horas</span>
            <span className={`text-2xl font-bold ${saldoColor}`}>
              {saldoFormatado}
            </span>
          </div>

          {/* KPI Horas Trabalhadas (TODO) */}
          <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg opacity-50">
            <FontAwesomeIcon icon={faHourglassHalf} className="text-2xl text-gray-500 mb-2" />
            <span className="text-xs text-gray-500 uppercase font-medium">Horas no Mês</span>
            <span className="text-2xl font-bold text-gray-700">
              N/A
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
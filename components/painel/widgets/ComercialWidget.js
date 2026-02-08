// components/painel/widgets/ComercialWidget.js
// CÓDIGO COMPLETO

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers } from '@fortawesome/free-solid-svg-icons';
import { startOfWeek, format } from 'date-fns';

// O PORQUÊ: Este widget busca dados de CRM (Novos Leads da Semana).
// Ele usa useQuery e só será mostrado se o usuário tiver a permissão "crm_pode_ver".

// Função de busca de dados
async function fetchResumoComercial() {
  const supabase = createClientComponentClient();
  const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { count, error } = await supabase
    .from('contatos')
    .select('id', { count: 'exact' })
    .eq('origem', 'meta_lead_id')
    .gte('created_at', inicioSemana);

  if (error) {
    console.error('Erro ao buscar resumo comercial:', error);
    throw new Error('Não foi possível carregar o resumo comercial.');
  }
  return count;
}

export default function ComercialWidget() {
  const { data: novosLeads, isLoading, error } = useQuery({
    queryKey: ['resumoComercialPainel'],
    queryFn: fetchResumoComercial,
  });

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Comercial</h3>
      {isLoading ? (
        <div className="flex justify-center items-center h-24">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500">{error.message}</div>
      ) : (
        <div className="flex items-center space-x-4">
          <FontAwesomeIcon icon={faUsers} className="text-4xl text-green-500" />
          <div>
            <span className="text-sm text-gray-500">Novos Leads (Semana)</span>
            <p className="text-4xl font-bold text-gray-800">
              {novosLeads}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
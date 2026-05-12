// components/painel/widgets/MinhasAtividadesWidget.js
"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTasks, faFilter, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import AtividadeCard from './AtividadeCard';
import Link from 'next/link';
import { isToday, isThisWeek, parseISO, isBefore, startOfToday } from 'date-fns';

async function fetchAtividades(funcionario_id, filtroTipo) {
  const supabase = createClient();
  let query = supabase
    .from('activities')
    .select(`
      id,
      nome,
      data_inicio_prevista,
      data_inicio_real,
      data_fim_prevista,
      status,
      responsavel_texto,
      empreendimentos ( nome ),
      funcionarios ( full_name )
    `);

  if (filtroTipo === 'minhas') {
    query = query.eq('funcionario_id', funcionario_id).not('status', 'in', '("Concluído", "Cancelado")');
  } else if (filtroTipo === 'todas') {
    query = query.not('status', 'in', '("Concluído", "Cancelado")');
  } else if (filtroTipo === 'andamento') {
    query = query.eq('status', 'Em andamento');
  }

  // Ordenar por data inicial (mais antigas primeiro)
  query = query.order('data_inicio_prevista', { ascending: true, nullsLast: true }).limit(100);

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar atividades:', error);
    throw new Error('Não foi possível carregar as atividades.');
  }
  return data;
}

export default function MinhasAtividadesWidget({ funcionario_id }) {
  const [filtroTipo, setFiltroTipo] = useState('todas'); // Default: ver tudo
  const [filtroData, setFiltroData] = useState('todas'); // 'todas', 'atrasadas', 'hoje', 'semana'

  const { data: atividadesRaw, isLoading, error } = useQuery({
    queryKey: ['atividadesPainel', funcionario_id, filtroTipo],
    queryFn: () => fetchAtividades(funcionario_id, filtroTipo),
    enabled: !!funcionario_id,
  });

  const atividadesFiltradas = useMemo(() => {
    if (!atividadesRaw) return [];
    
    let filtradas = [...atividadesRaw];
    const hoje = startOfToday();

    if (filtroData !== 'todas') {
      filtradas = filtradas.filter(at => {
        // Considera data real, ou a prevista se não tiver
        const dataConsiderada = at.data_inicio_real || at.data_inicio_prevista || at.data_fim_prevista;
        if (!dataConsiderada) return false;

        const dateObj = parseISO(dataConsiderada);
        
        if (filtroData === 'atrasadas') {
          return isBefore(dateObj, hoje) && at.status !== 'Concluído';
        }
        if (filtroData === 'hoje') {
          return isToday(dateObj);
        }
        if (filtroData === 'semana') {
          return isThisWeek(dateObj, { weekStartsOn: 0 }); // Domingo
        }
        return true;
      });
    }

    return filtradas.slice(0, 15); // Mostra as top 15 depois do filtro local
  }, [atividadesRaw, filtroData]);

  const tituloWidget = filtroTipo === 'minhas' 
    ? 'Minhas Atividades' 
    : filtroTipo === 'andamento' 
      ? 'Em Andamento' 
      : 'Atividades da Empresa';

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 flex flex-col h-full min-h-[400px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h3 className="text-lg font-semibold text-gray-800">{tituloWidget}</h3>
        
        {/* Controles de Filtro */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tipo de Atividade */}
          <div className="relative">
             <select
               value={filtroTipo}
               onChange={(e) => setFiltroTipo(e.target.value)}
               className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
             >
               <option value="todas">Todas</option>
               <option value="minhas">Minhas</option>
               <option value="andamento">Em andamento</option>
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
               <FontAwesomeIcon icon={faFilter} className="w-3 h-3" />
             </div>
          </div>
          
          {/* Filtro de Data */}
          <div className="relative">
             <select
               value={filtroData}
               onChange={(e) => setFiltroData(e.target.value)}
               className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
             >
               <option value="todas">Qualquer data</option>
               <option value="atrasadas">Atrasadas</option>
               <option value="hoje">Para hoje</option>
               <option value="semana">Esta semana</option>
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
               <FontAwesomeIcon icon={faCalendarAlt} className="w-3 h-3" />
             </div>
          </div>

          <Link href="/atividades" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg ml-1">
            Ver painel
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 flex justify-center items-center h-32">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
          <span className="ml-3 text-sm font-medium text-gray-500">Buscando atividades...</span>
        </div>
      )}

      {error && (
        <div className="text-center text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-sm font-medium">{error.message}</div>
      )}

      {!isLoading && !error && atividadesFiltradas?.length > 0 && (
        <div className="flex flex-col space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
          {atividadesFiltradas.map(at => (
            <AtividadeCard key={at.id} atividade={at} />
          ))}
        </div>
      )}

      {!isLoading && !error && atividadesFiltradas?.length === 0 && (
        <div className="flex-1 flex flex-col justify-center items-center h-32 text-gray-400 mt-8">
          <FontAwesomeIcon icon={faTasks} className="text-4xl mb-3 text-gray-300" />
          <span className="text-sm font-medium">Nenhuma atividade encontrada neste filtro.</span>
        </div>
      )}
    </div>
  );
}
// components/painel/SmartKpiCard.js
"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationCircle, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import * as IconsSolid from '@fortawesome/free-solid-svg-icons';

export default function SmartKpiCard({ kpi, onEdit, onDelete }) {
  const supabase = createClient();
  const { user } = useAuth();

  const { data: resultado, isLoading, error } = useQuery({
    queryKey: ['kpi_value_consolidado', kpi.id, kpi.filtros_config],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
        p_organizacao_id: user?.organizacao_id,
        p_filtros: kpi.filtros_config,
        p_escopo: 'KPI'
      });

      if (error) throw error;
      return data.valor; // A função agora retorna um JSON { valor: ... }
    },
    enabled: !!user?.organizacao_id && !!kpi.filtros_config,
    staleTime: 1000 * 60 * 5 
  });

  const IconComponent = IconsSolid[kpi.icone] || IconsSolid.faChartPie;

  return (
    <div className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && <button onClick={() => onEdit(kpi)} className="text-gray-400 hover:text-blue-500 p-1"><FontAwesomeIcon icon={faEdit} size="sm" /></button>}
        {onDelete && <button onClick={() => onDelete(kpi)} className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faTrash} size="sm" /></button>}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider truncate max-w-[80%]">{kpi.titulo}</h3>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.cor}20`, color: kpi.cor }}>
          <FontAwesomeIcon icon={IconComponent} className="text-lg" />
        </div>
      </div>

      <div className="min-h-[40px] flex items-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><FontAwesomeIcon icon={faSpinner} spin /><span>Calculando...</span></div>
        ) : error ? (
          <div className="text-red-400 text-xs flex items-center gap-1" title={error.message}><FontAwesomeIcon icon={faExclamationCircle} /> Erro</div>
        ) : (
          <p className="text-3xl font-extrabold tracking-tight text-gray-800">
            {Number(resultado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2 truncate">Baseado em filtros personalizados</p>
    </div>
  );
}
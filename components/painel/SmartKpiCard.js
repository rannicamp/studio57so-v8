"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationCircle, faEdit, faTrash, faCalculator } from '@fortawesome/free-solid-svg-icons';
import * as IconsSolid from '@fortawesome/free-solid-svg-icons';

export default function SmartKpiCard({ kpi, onEdit, onDelete }) {
  const supabase = createClient();
  const { user } = useAuth();
  
  const tipo = kpi?.filtros?._config_tipo || 'filtro';

  const { data: resultado, isLoading, isError } = useQuery({
    queryKey: ['kpi_value_smart_v11', kpi.id, kpi.filtros, tipo], 
    queryFn: async () => {
      // === O TRADUTOR UNIVERSAL (CORREÇÃO CRÍTICA) ===
      const normalizarFiltros = (filtrosCrus) => {
          return {
              // Verifica AMBOS os formatos (Novo || Antigo || Nulo)
              startDate: filtrosCrus.startDate || filtrosCrus.data_inicio || null,
              endDate: filtrosCrus.endDate || filtrosCrus.data_fim || null,

              // Tratamento de Arrays (Garante que sempre seja array de IDs)
              categoriaIds: Array.isArray(filtrosCrus.categoriaIds) 
                  ? filtrosCrus.categoriaIds 
                  : (Array.isArray(filtrosCrus.categorias) ? filtrosCrus.categorias.map(c => c?.id || c) : []),
              
              contaIds: Array.isArray(filtrosCrus.contaIds)
                  ? filtrosCrus.contaIds
                  : (Array.isArray(filtrosCrus.contas) ? filtrosCrus.contas.map(c => c?.id || c) : []),
              
              empresaIds: Array.isArray(filtrosCrus.empresaIds)
                  ? filtrosCrus.empresaIds
                  : (Array.isArray(filtrosCrus.empresas) ? filtrosCrus.empresas.map(c => c?.id || c) : []),
                  
              empreendimentoIds: Array.isArray(filtrosCrus.empreendimentoIds)
                  ? filtrosCrus.empreendimentoIds
                  : (Array.isArray(filtrosCrus.empreendimentos) ? filtrosCrus.empreendimentos.map(c => c?.id || c) : []),

              etapaIds: filtrosCrus.etapaIds || [],

              // Status e Tipo
              status: Array.isArray(filtrosCrus.status) 
                  ? filtrosCrus.status.filter(s => s !== 'todos') 
                  : (filtrosCrus.status === 'todos' ? [] : [filtrosCrus.status].filter(Boolean)),
                  
              tipo: Array.isArray(filtrosCrus.tipo) 
                  ? filtrosCrus.tipo 
                  : (filtrosCrus.tipo === 'todos' ? [] : [filtrosCrus.tipo].filter(Boolean)),

              // Flags
              ignoreTransfers: filtrosCrus.ignoreTransfers ?? true,
              ignoreChargebacks: filtrosCrus.ignoreChargebacks ?? true,
              useCompetencia: filtrosCrus.useCompetencia ?? false
          };
      };

      // MODO 1: KPI SIMPLES
      if (tipo === 'filtro') {
        const filtrosProntos = normalizarFiltros(kpi.filtros || {});

        const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
          p_organizacao_id: user?.organizacao_id,
          p_filtros: filtrosProntos,
          p_escopo: 'KPI'
        });

        if (error) {
            console.error(`[SmartKpiCard] Erro SQL:`, error);
            throw error;
        }

        return Number(data?.resultado || 0);
      }

      // MODO 2: KPI COMPOSTO (Fórmula)
      if (tipo === 'formula') {
        const expressao = kpi.filtros?.formula_expressao || '';
        if (!expressao) return 0;

        const regex = /@\{\s*([a-zA-Z0-9\-]+)\s*\}/g;
        const matches = [...expressao.matchAll(regex)];
        const idsNecessarios = [...new Set(matches.map(m => m[1]))];

        let formulaFinal = expressao;

        if (idsNecessarios.length > 0) {
            const { data: kpisFilhos } = await supabase
                .from('kpis_personalizados')
                .select('id, filtros')
                .in('id', idsNecessarios);
            
            const valoresFilhos = {};
            await Promise.all((kpisFilhos || []).map(async (filho) => {
                if (filho.filtros?._config_tipo === 'formula') { valoresFilhos[filho.id] = 0; return; }
                const filtrosFilhoProntos = normalizarFiltros(filho.filtros || {});
                const { data } = await supabase.rpc('get_financeiro_consolidado', {
                    p_organizacao_id: user?.organizacao_id,
                    p_filtros: filtrosFilhoProntos,
                    p_escopo: 'KPI'
                });
                valoresFilhos[filho.id] = Number(data?.resultado || 0);
            }));

            idsNecessarios.forEach(id => {
                const valor = valoresFilhos[id] !== undefined ? valoresFilhos[id] : 0;
                formulaFinal = formulaFinal.replace(new RegExp(`@\\{\\s*${id}\\s*\\}`, 'g'), `(${valor})`);
            });
        }

        try {
            const cleanFormula = formulaFinal.replace(/[^0-9\.\+\-\*\/\(\)\s]/g, ''); 
            // eslint-disable-next-line no-new-func
            const calculo = new Function(`return ${cleanFormula}`)();
            return isFinite(calculo) ? calculo : 0;
        } catch (e) { return 0; }
      }
      return 0;
    },
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 
  });

  const IconComponent = IconsSolid[kpi.icone] || IconsSolid.faChartPie;
  const formato = kpi.filtros?.formula_formato || 'moeda';
  const cor = kpi.cor || kpi.filtros?._meta_visual?.cor || '#3B82F6';

  const formatValue = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '...';
    if (formato === 'moeda') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (formato === 'porcentagem') return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    return val.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  };

  return (
    <div className={`group relative bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-md ${tipo === 'formula' ? 'border-purple-100 bg-purple-50/10' : 'border-gray-100'}`}>
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onEdit && <button onClick={() => onEdit(kpi)} className="text-gray-400 hover:text-blue-500 p-1"><FontAwesomeIcon icon={faEdit} size="sm" /></button>}
        {onDelete && <button onClick={() => onDelete(kpi)} className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faTrash} size="sm" /></button>}
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider truncate max-w-[80%] flex items-center gap-1">
            {kpi.titulo}
            {tipo === 'formula' && <FontAwesomeIcon icon={faCalculator} className="text-[10px] text-purple-300" />}
        </h3>
        <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: `${cor}20`, color: cor }}>
          <FontAwesomeIcon icon={IconComponent} className="text-lg" />
        </div>
      </div>
      <div className="min-h-[40px] flex items-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><FontAwesomeIcon icon={faSpinner} spin /><span>Calculando...</span></div>
        ) : isError ? (
          <div className="text-red-400 text-xs flex items-center gap-1"><FontAwesomeIcon icon={faExclamationCircle} /> Erro</div>
        ) : (
          <p className="text-3xl font-extrabold tracking-tight text-gray-800">{formatValue(resultado)}</p>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2 truncate">{tipo === 'formula' ? 'Cálculo Automático' : 'Baseado em filtros inteligentes'}</p>
    </div>
  );
}
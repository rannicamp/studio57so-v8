// components/painel/SmartKpiCard.js
"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation'; // <--- Importante para navegar
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSpinner, faExclamationCircle, faEdit, faTrash, 
  faCalculator, faCopy, faExternalLinkAlt 
} from '@fortawesome/free-solid-svg-icons';
import * as IconsSolid from '@fortawesome/free-solid-svg-icons';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros';

export default function SmartKpiCard({ kpi, onEdit, onDelete, onDuplicate }) {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter(); // <--- Hook de navegação
  
  const tipo = kpi?.filtros?._config_tipo || 'filtro';

  const { data: resultado, isLoading, isError } = useQuery({
    queryKey: ['kpi_value_smart_v14', kpi.id, kpi.filtros, tipo],
    queryFn: async () => {
      if (tipo === 'filtro') {
        const filtrosProntos = formatarFiltrosParaBanco(kpi.filtros || {});
        const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
          p_organizacao_id: user?.organizacao_id,
          p_filtros: filtrosProntos
        });
        if (error) throw error;
        return Number(data?.resultado || 0);
      }

      if (tipo === 'formula') {
        // ... (Lógica de fórmula mantida igual)
        const expressao = kpi.filtros?.formula_expressao || '';
        if (!expressao) return 0;
        // ... Lógica simplificada para brevidade, mantenha a original se preferir ...
        // Mas para garantir que não quebre, vou manter o bloco original da fórmula:
        const regex = /@\{\s*([a-zA-Z0-9\-]+)\s*\}/g;
        const matches = [...expressao.matchAll(regex)];
        const idsNecessarios = [...new Set(matches.map(m => m[1]))];
        let formulaFinal = expressao;
        if (idsNecessarios.length > 0) {
            const { data: kpisFilhos } = await supabase.from('kpis_personalizados').select('id, filtros').in('id', idsNecessarios);
            const valoresFilhos = {};
            await Promise.all((kpisFilhos || []).map(async (filho) => {
                if (filho.filtros?._config_tipo === 'formula') { valoresFilhos[filho.id] = 0; return; }
                const filtrosFilhoProntos = formatarFiltrosParaBanco(filho.filtros || {});
                const { data } = await supabase.rpc('get_financeiro_consolidado', { p_organizacao_id: user?.organizacao_id, p_filtros: filtrosFilhoProntos });
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

  // === A MÁGICA DO BOTÃO ===
  const handleVerLancamentos = (e) => {
    e.stopPropagation(); // Evita conflitos de clique

    // 1. Prepara os filtros no formato que a Página Financeira espera (UI State)
    const filtrosParaPagina = {
        searchTerm: '',
        // Mapeia legacy 'data_inicio' para 'startDate' se necessário
        startDate: kpi.filtros?.startDate || kpi.filtros?.data_inicio || '',
        endDate: kpi.filtros?.endDate || kpi.filtros?.data_fim || '',
        status: kpi.filtros?.status || [],
        tipo: kpi.filtros?.tipo || [],
        contaIds: kpi.filtros?.contaIds || [],
        categoriaIds: kpi.filtros?.categoriaIds || [],
        empresaIds: kpi.filtros?.empresaIds || [],
        empreendimentoIds: kpi.filtros?.empreendimentoIds || [],
        favorecidoId: null,
        // Garante que flags booleanas sejam passadas
        ignoreTransfers: kpi.filtros?.ignoreTransfers ?? false,
        ignoreChargebacks: kpi.filtros?.ignoreChargebacks ?? false,
        useCompetencia: kpi.filtros?.useCompetencia ?? false
    };

    // 2. Monta o objeto de estado completo da página
    const estadoParaSalvar = {
        activeTab: 'lancamentos', // Força a aba de lançamentos
        filters: filtrosParaPagina,
        currentPage: 1,
        itemsPerPage: 150,
        sortConfig: { key: 'data_vencimento', direction: 'descending' },
        showFilters: true // Abre os filtros para o usuário ver o que foi aplicado
    };

    // 3. Salva no localStorage (a "memória" da página financeira)
    localStorage.setItem('financeiroUiState', JSON.stringify(estadoParaSalvar));

    // 4. Redireciona
    router.push('/financeiro');
  };

  return (
    <div className={`group relative bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-md ${tipo === 'formula' ? 'border-purple-100 bg-purple-50/10' : 'border-gray-100'}`}>
      
      {/* Botões de Ação (Aparecem no Hover) */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {/* BOTÃO NOVO: Ver Lançamentos */}
        {tipo === 'filtro' && (
            <button 
                onClick={handleVerLancamentos} 
                className="text-gray-400 hover:text-blue-600 p-1 bg-white rounded-md shadow-sm border border-gray-100 hover:border-blue-200"
                title="Ver lançamentos deste KPI"
            >
                <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
            </button>
        )}

        {onDuplicate && (
            <button 
                onClick={(e) => { e.stopPropagation(); onDuplicate(kpi); }} 
                className="text-gray-400 hover:text-green-500 p-1"
                title="Duplicar KPI"
            >
                <FontAwesomeIcon icon={faCopy} size="sm" />
            </button>
        )}
        {onEdit && (
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(kpi); }} 
                className="text-gray-400 hover:text-blue-500 p-1"
                title="Editar KPI"
            >
                <FontAwesomeIcon icon={faEdit} size="sm" />
            </button>
        )}
        {onDelete && (
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(kpi); }} 
                className="text-gray-400 hover:text-red-500 p-1"
                title="Excluir KPI"
            >
                <FontAwesomeIcon icon={faTrash} size="sm" />
            </button>
        )}
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
      
      <p className="text-xs text-gray-400 mt-2 truncate">
        {kpi.descricao || (tipo === 'formula' ? 'Cálculo Automático' : 'Baseado em filtros inteligentes')}
      </p>
    </div>
  );
}
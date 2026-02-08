"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

// Componentes
import SmartKpiCard from '@/components/painel/SmartKpiCard';
import SmartChartCard from '@/components/painel/SmartChartCard'; 
import KpiPlaceholder from '@/components/painel/KpiPlaceholder';
import KpiBuilderModal from '@/components/painel/KpiBuilderModal';
import FinanceiroDashboard from '@/components/relatorios/financeiro/FinanceiroDashboard';

export default function RelatorioFinanceiroPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [kpiParaEditar, setKpiParaEditar] = useState(null);

  // Estado Local para Drag & Drop visual
  const [localKpis, setLocalKpis] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);

  // --- BUSCA DE DADOS ---
  const { data: meusKpis = [], isLoading } = useQuery({
    queryKey: ['meus_kpis', user?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', user?.organizacao_id)
        .eq('modulo', 'financeiro')
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organizacao_id
  });

  // Atualiza o estado local
  useEffect(() => {
    if (meusKpis.length > 0) {
        setLocalKpis(meusKpis);
    }
  }, [meusKpis]);

  // --- AGRUPAMENTO ---
  const kpisAgrupados = useMemo(() => {
    const grupos = {};
    const listaParaAgrupar = localKpis.length > 0 ? localKpis : meusKpis;

    listaParaAgrupar.forEach(kpi => {
        const nomeGrupo = kpi.grupo || 'Geral';
        if (!grupos[nomeGrupo]) grupos[nomeGrupo] = [];
        grupos[nomeGrupo].push(kpi);
    });

    const chavesOrdenadas = Object.keys(grupos).sort((a, b) => {
        if (a === 'Geral') return -1;
        if (b === 'Geral') return 1;
        return a.localeCompare(b);
    });

    return { grupos, chavesOrdenadas };
  }, [localKpis, meusKpis]);

  // --- DRAG & DROP LOGIC ---
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    const novaLista = [...localKpis];
    const draggedIndex = novaLista.findIndex(i => i.id === draggedItem.id);
    const targetIndex = novaLista.findIndex(i => i.id === targetItem.id);

    const [itemRemovido] = novaLista.splice(draggedIndex, 1);
    const novoGrupo = targetItem.grupo || 'Geral';
    const itemAtualizado = { ...itemRemovido, grupo: novoGrupo };

    novaLista.splice(targetIndex, 0, itemAtualizado);

    setLocalKpis(novaLista);
    salvarReordenacao(novaLista);
  };

  const salvarReordenacao = async (lista) => {
    try {
        const updates = lista.map((item, index) => {
            return supabase
                .from('kpis_personalizados')
                .update({ 
                    ordem: index,
                    grupo: item.grupo 
                })
                .eq('id', item.id);
        });

        await Promise.all(updates);
        queryClient.invalidateQueries(['meus_kpis']);
    } catch (error) {
        console.error("Erro ao salvar ordem:", error);
        toast.error("Erro ao salvar a organização.");
    }
  };

  // --- AÇÕES ---
  const handleNovoKpi = () => { setKpiParaEditar(null); setIsModalOpen(true); };
  const handleEditKpi = (kpi) => { setKpiParaEditar(kpi); setIsModalOpen(true); };
  
  const handleDeleteKpi = async (kpi) => {
    if(!confirm(`Excluir "${kpi.titulo}"?`)) return;
    try {
        await supabase.from('kpis_personalizados').delete().eq('id', kpi.id);
        toast.success("Removido.");
        queryClient.invalidateQueries(['meus_kpis']);
    } catch (error) { toast.error("Erro ao excluir."); }
  };

  // --- FUNÇÃO DUPLICAR ---
  const handleDuplicateKpi = async (kpiOriginal) => {
      try {
          const { id, created_at, ...dadosKpi } = kpiOriginal;
          
          const novoKpi = {
              ...dadosKpi,
              titulo: `${dadosKpi.titulo} (Cópia)`,
              organizacao_id: user.organizacao_id
          };

          const { error } = await supabase
              .from('kpis_personalizados')
              .insert(novoKpi);

          if (error) throw error;

          toast.success("Duplicado com sucesso!");
          queryClient.invalidateQueries(['meus_kpis']);
      } catch (error) {
          console.error("Erro ao duplicar:", error);
          toast.error("Erro ao duplicar.");
      }
  };

  return (
    <div className="h-full w-full space-y-8 p-2">
      
      {/* SEÇÃO DE KPIS (AGRUPADOS) */}
      <section>
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 p-2 rounded-lg"><FontAwesomeIcon icon={faLayerGroup} /></span>
                Painel de Indicadores
            </h2>
            <button onClick={handleNovoKpi} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                + Novo Indicador
            </button>
        </div>

        {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Carregando...
            </div>
        ) : (
            <div className="space-y-8">
                {kpisAgrupados.chavesOrdenadas.map(grupoNome => (
                    <div key={grupoNome} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2 pl-1">
                            {grupoNome}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {kpisAgrupados.grupos[grupoNome].map((kpi) => {
                                const isGrafico = kpi.tipo_visualizacao?.startsWith('grafico');
                                const colSpan = isGrafico ? 'lg:col-span-2' : 'lg:col-span-1';

                                return (
                                    <div 
                                        key={kpi.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, kpi)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, kpi)}
                                        className={`cursor-move transition-all duration-200 hover:-translate-y-1 ${colSpan}`}
                                    >
                                        {isGrafico ? (
                                            <SmartChartCard 
                                                kpi={kpi}
                                                onEdit={() => handleEditKpi(kpi)}
                                                onDelete={() => handleDeleteKpi(kpi)}
                                                onDuplicate={() => handleDuplicateKpi(kpi)}
                                            />
                                        ) : (
                                            <SmartKpiCard 
                                                kpi={{
                                                    id: kpi.id,
                                                    titulo: kpi.titulo,
                                                    descricao: kpi.descricao, // <--- AQUI ESTAVA FALTANDO!
                                                    icone: kpi.filtros?._meta_visual?.icone || kpi.icone || 'faChartPie',
                                                    cor: kpi.filtros?._meta_visual?.cor || '#3B82F6',
                                                    filtros: kpi.filtros
                                                }}
                                                onEdit={() => handleEditKpi(kpi)}
                                                onDelete={() => handleDeleteKpi(kpi)}
                                                onDuplicate={() => handleDuplicateKpi(kpi)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            
                            {kpisAgrupados.grupos[grupoNome].length === 0 && (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex items-center justify-center text-gray-400 text-sm">
                                    Arraste itens para cá
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {kpisAgrupados.chavesOrdenadas.length === 0 && (
                    <div className="text-center py-10">
                        <KpiPlaceholder onClick={handleNovoKpi} />
                    </div>
                )}
            </div>
        )}
      </section>

      <hr className="border-gray-200" />

      {/* DASHBOARD ANTIGO */}
      <section>
         <h2 className="text-lg font-bold text-gray-700 border-l-4 border-indigo-500 pl-3 mb-4">
            Análise Gráfica Detalhada
         </h2>
         <FinanceiroDashboard />
      </section>

      <KpiBuilderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        kpiToEdit={kpiParaEditar}
        onSaveSuccess={() => {
            queryClient.invalidateQueries(['meus_kpis']);
            queryClient.invalidateQueries({ queryKey: ['kpi_value_smart_v13'] });
        }}
      />
    </div>
  );
}
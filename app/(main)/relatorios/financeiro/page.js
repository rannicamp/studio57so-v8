// app/(main)/relatorios/financeiro/page.js
"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Componentes
import SmartKpiCard from '@/components/painel/SmartKpiCard';
import KpiPlaceholder from '@/components/painel/KpiPlaceholder';
import KpiBuilderModal from '@/components/painel/KpiBuilderModal';
import FinanceiroDashboard from '@/components/relatorios/financeiro/FinanceiroDashboard';

export default function RelatorioFinanceiroPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Controle do Modal e Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [kpiParaEditar, setKpiParaEditar] = useState(null);

  // Estados para Organização (Drag & Drop Nativo)
  const [itemsOrdenados, setItemsOrdenados] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);

  // Busca KPIs
  const { data: meusKpis = [], isLoading } = useQuery({
    queryKey: ['meus_kpis', user?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', user?.organizacao_id)
        .eq('modulo', 'financeiro')
        .order('ordem', { ascending: true, nullsFirst: false }) // Prioridade para a ordem
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organizacao_id
  });

  // Sincroniza o estado local quando os dados chegam do banco
  useEffect(() => {
    if (meusKpis.length > 0) {
        setItemsOrdenados(meusKpis);
    }
  }, [meusKpis]);

  // --- LÓGICA DRAG & DROP (NATIVO) ---

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', ''); // Necessário para Firefox
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

  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetItem.id) return;

    // Lógica de Reordenação Visual (Imediata)
    const novaLista = [...itemsOrdenados];
    const draggedIndex = novaLista.findIndex(i => i.id === draggedItem.id);
    const targetIndex = novaLista.findIndex(i => i.id === targetItem.id);

    const [itemRemovido] = novaLista.splice(draggedIndex, 1);
    novaLista.splice(targetIndex, 0, itemRemovido);

    setItemsOrdenados(novaLista);
    
    // Salva no banco
    salvarNovaOrdem(novaLista);
  };

  // --- CORREÇÃO AQUI ---
  const salvarNovaOrdem = async (listaReordenada) => {
      try {
          // Estratégia "Promise.all": Atualiza todos simultaneamente
          // Isso evita erros de "upsert" com campos obrigatórios ausentes
          const updates = listaReordenada.map((item, index) => {
              return supabase
                  .from('kpis_personalizados')
                  .update({ ordem: index }) // Atualiza SÓ a ordem
                  .eq('id', item.id);       // Do item específico
          });

          // Aguarda todos terminarem
          await Promise.all(updates);

          // Atualiza o cache silenciosamente
          queryClient.invalidateQueries(['meus_kpis']);
          
      } catch (error) {
          console.error("Erro ao salvar ordem:", error);
          toast.error("Erro de conexão ao salvar a ordem.");
      }
  };

  // --- AÇÕES DO USUÁRIO ---

  const handleNovoKpi = () => {
    setKpiParaEditar(null);
    setIsModalOpen(true);
  };

  const handleEditKpi = (kpi) => {
    setKpiParaEditar(kpi);
    setIsModalOpen(true);
  };

  const handleDeleteKpi = async (kpi) => {
    if(!confirm(`Deseja realmente excluir "${kpi.titulo}"?`)) return;

    try {
        const { error } = await supabase.from('kpis_personalizados').delete().eq('id', kpi.id);
        if (error) throw error;
        toast.success("Indicador removido.");
        queryClient.invalidateQueries(['meus_kpis']);
    } catch (error) {
        toast.error("Erro ao excluir.");
    }
  };

  return (
    <div className="h-full w-full space-y-8 p-2">
      
      {/* 1. ÁREA DE KPIs PERSONALIZADOS */}
      <section>
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-700 border-l-4 border-blue-500 pl-3">
                Meus Indicadores
            </h2>
            <span className="text-xs text-gray-400 italic hidden md:block">
                Arraste para organizar
            </span>
        </div>

        {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-10">
                <FontAwesomeIcon icon={faSpinner} spin /> Carregando seus indicadores...
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {itemsOrdenados.map((kpi) => (
                    <div 
                        key={kpi.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, kpi)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, kpi)}
                        className="cursor-move transition-transform duration-200 active:scale-95"
                        title="Segure e arraste para mover"
                    >
                        <SmartKpiCard 
                            kpi={{
                                id: kpi.id,
                                titulo: kpi.titulo,
                                icone: kpi.filtros?._meta_visual?.icone || kpi.icone || 'faChartPie',
                                cor: kpi.filtros?._meta_visual?.cor || '#3B82F6',
                                filtros: kpi.filtros
                            }}
                            onEdit={() => handleEditKpi(kpi)}
                            onDelete={() => handleDeleteKpi(kpi)}
                        />
                    </div>
                ))}

                {/* Botão de Criar Novo */}
                <div className="h-full">
                    <KpiPlaceholder onClick={handleNovoKpi} />
                </div>
            </div>
        )}
      </section>

      <hr className="border-gray-200" />

      {/* 2. DASHBOARD ANTIGO */}
      <section>
         <h2 className="text-lg font-bold text-gray-700 border-l-4 border-indigo-500 pl-3 mb-4">
            Análise Gráfica Detalhada
         </h2>
         <FinanceiroDashboard />
      </section>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <KpiBuilderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        kpiToEdit={kpiParaEditar}
        onSaveSuccess={() => {
            queryClient.invalidateQueries(['meus_kpis']);
            queryClient.invalidateQueries({ queryKey: ['kpi_value_smart_v7'] });
        }}
      />

    </div>
  );
}
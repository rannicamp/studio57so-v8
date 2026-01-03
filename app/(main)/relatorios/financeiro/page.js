// app/(main)/relatorios/financeiro/page.js
"use client";

import React, { useState } from 'react';
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
  const [kpiParaEditar, setKpiParaEditar] = useState(null); // Estado para guardar qual KPI estamos editando

  // Busca KPIs
  const { data: meusKpis = [], isLoading } = useQuery({
    queryKey: ['meus_kpis', user?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', user?.organizacao_id)
        .eq('modulo', 'financeiro')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.organizacao_id
  });

  // ABRIR PARA CRIAÇÃO
  const handleNovoKpi = () => {
    setKpiParaEditar(null); // Garante que está limpo (Modo Criação)
    setIsModalOpen(true);
  };

  // ABRIR PARA EDIÇÃO
  const handleEditKpi = (kpi) => {
    setKpiParaEditar(kpi); // Carrega os dados (Modo Edição)
    setIsModalOpen(true);
  };

  // DELETAR
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
        </div>

        {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 py-10">
                <FontAwesomeIcon icon={faSpinner} spin /> Carregando seus indicadores...
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Lista os KPIs vindos do Banco */}
                {meusKpis.map((kpi) => (
                    <SmartKpiCard 
                        key={kpi.id}
                        kpi={{
                            id: kpi.id,
                            titulo: kpi.titulo,
                            icone: kpi.filtros?._meta_visual?.icone || kpi.icone || 'faChartPie',
                            cor: kpi.filtros?._meta_visual?.cor || '#3B82F6',
                            filtros_config: kpi.filtros
                        }}
                        onEdit={() => handleEditKpi(kpi)} // Passa a função de editar
                        onDelete={() => handleDeleteKpi(kpi)}
                    />
                ))}

                {/* Botão de Criar Novo */}
                <KpiPlaceholder onClick={handleNovoKpi} />
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
        kpiToEdit={kpiParaEditar} // Passa o KPI atual (ou null se for novo)
        onSaveSuccess={() => {
            queryClient.invalidateQueries(['meus_kpis']);
            // Opcional: queryClient.invalidateQueries(['kpi_value']); para forçar recalculo dos valores
        }}
      />

    </div>
  );
}
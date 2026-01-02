// app/(main)/relatorios/page.js
"use client";

import { useAuth } from '@/contexts/AuthContext';
import NotificationTimeline from '@/components/dashboard/NotificationTimeline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTools, faChartPie } from '@fortawesome/free-solid-svg-icons';

// Importamos a página de RH existente
import RelatorioRhPage from './rh/page'; 

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen pb-10">
      
      {/* HEADER DO DASHBOARD */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Visão Geral</h1>
            <p className="text-sm text-gray-500 mt-1">
                Monitoramento estratégico e operacional • {user?.nome_organizacao || 'Sua Organização'}
            </p>
        </div>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        
        {/* COLUNA ESQUERDA (1/4): Timeline de Eventos */}
        <div className="xl:col-span-1 w-full order-2 xl:order-1 sticky top-4">
            <NotificationTimeline />
        </div>

        {/* COLUNA DIREITA (3/4): Relatórios e Widgets */}
        <div className="xl:col-span-3 w-full order-1 xl:order-2 space-y-8">
            
            {/* 1. INDICADORES CHAVE (EM CONSTRUÇÃO) */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center text-center min-h-[200px] bg-gray-50/50">
                 <div className="bg-blue-100 text-blue-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={faChartPie} className="text-2xl" />
                 </div>
                 <h3 className="text-xl font-bold text-gray-700">Indicadores Chave de Desempenho (KPIs)</h3>
                 <p className="text-gray-500 max-w-md mt-2 mb-4">
                    Estamos compilando métricas de Vendas, Financeiro e Operacional para criar um painel executivo unificado aqui.
                 </p>
                 <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wide">
                    <FontAwesomeIcon icon={faTools} /> Em Construção
                 </span>
            </div>

            {/* 2. MÓDULO RH (Existente) */}
            <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                 <RelatorioRhPage />
            </div>

        </div>

      </div>
    </div>
  );
}
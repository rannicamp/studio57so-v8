// app/(main)/relatorios/page.js
"use client";

import NotificationTimeline from '@/components/dashboard/NotificationTimeline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartPie, faTools } from '@fortawesome/free-solid-svg-icons';

export default function DashboardGeralPage() {
  return (
    <div className="h-full">
      
      {/* GRID PRINCIPAL: 1 Coluna (Mobile) -> 4 Colunas (PC) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        
        {/* === COLUNA ESQUERDA (1/4): TIMELINE DE EVENTOS === 
            Fica fixa na lateral para acompanhamento rápido */}
        <div className="xl:col-span-1 w-full order-2 xl:order-1 sticky top-4">
            <NotificationTimeline />
        </div>

        {/* === COLUNA DIREITA (3/4): ÁREA DE KPIs GERAIS === */}
        <div className="xl:col-span-3 w-full order-1 xl:order-2">
            
            {/* ÁREA DE KPIs CONSOLIDADOS (Sem o banner azul, direto ao ponto) */}
            <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 border-dashed flex flex-col items-center justify-center text-center min-h-[400px] bg-gray-50/50">
                 
                 <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <FontAwesomeIcon icon={faChartPie} className="text-3xl" />
                 </div>
                 
                 <h3 className="text-xl font-bold text-gray-800">Dashboard Executivo Unificado</h3>
                 
                 <p className="text-gray-500 max-w-lg mt-3 mb-6 leading-relaxed">
                    Estamos compilando os dados de <strong>Financeiro, RH e Obras</strong> para criar uma visão "Raio-X" de toda a empresa em uma única tela.
                 </p>
                 
                 <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wide">
                    <FontAwesomeIcon icon={faTools} /> Módulo em Construção
                 </span>
            </div>

        </div>

      </div>
    </div>
  );
}
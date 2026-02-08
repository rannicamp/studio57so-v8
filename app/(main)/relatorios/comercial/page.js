'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBuilding, 
  faCalendarAlt, 
  faFilter, 
  faChartBar, 
  faChartLine,
  faFileExport
} from '@fortawesome/free-solid-svg-icons';

// Importando componentes que já usamos no sistema para manter o padrão
import ConstrutorKpiManager from '@/components/painel/ConstrutorKpiManager';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function RelatorioComercialPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  
  // Controle de Datas
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('visao_geral'); // 'visao_geral', 'vendas', 'marketing'

  useEffect(() => {
    // Simulação de carregamento inicial
    setTimeout(() => setLoading(false), 800);
  }, []);

  const handleDateChange = (e, type) => {
    const newDate = e.target.value ? new Date(e.target.value) : new Date();
    setDateRange(prev => ({ ...prev, [type]: newDate }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartLine} className="text-blue-600" />
            Relatório Comercial
          </h1>
          <p className="text-slate-500 mt-1">
            Análise unificada de Marketing, Contratos e Vendas
          </p>
        </div>

        {/* Filtro de Data */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={format(dateRange.from, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e, 'from')}
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 p-0 outline-none"
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              value={format(dateRange.to, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e, 'to')}
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 p-0 outline-none"
            />
          </div>
        </div>
      </div>

      {/* --- ABAS DE NAVEGAÇÃO --- */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'visao_geral', label: 'Visão Geral', icon: faChartBar },
          { id: 'vendas', label: 'Contratos & Vendas', icon: faBuilding },
          { id: 'marketing', label: 'Marketing (Ads)', icon: faFilter },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'}
            `}
          >
            <FontAwesomeIcon icon={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- CONTEÚDO DINÂMICO --- */}
      <div className="space-y-6">
        
        {/* SEÇÃO 1: OS CARDS (KPIS) DINÂMICOS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Indicadores Chave</h2>
          </div>
          
          <ConstrutorKpiManager 
            modulo={activeTab === 'marketing' ? 'marketing' : 'comercial'} 
            organizacaoId={2}
          />
        </section>

        {/* SEÇÃO 2: GRÁFICOS (PLACEHOLDERS) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col justify-center items-center text-center">
             <div className="bg-blue-50 p-4 rounded-full mb-3">
                <FontAwesomeIcon icon={faChartBar} className="text-3xl text-blue-500" />
             </div>
             <h3 className="text-slate-600 font-medium">Gráfico de Evolução (Vendas x Metas)</h3>
             <p className="text-xs text-slate-400 mt-1">Será implementado na próxima etapa</p>
          </div>

          {/* Gráfico 2 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col justify-center items-center text-center">
             <div className="bg-purple-50 p-4 rounded-full mb-3">
                <FontAwesomeIcon icon={faFilter} className="text-3xl text-purple-500" />
             </div>
             <h3 className="text-slate-600 font-medium">Funil de Conversão (Leads -&gt; Contratos)</h3>
             <p className="text-xs text-slate-400 mt-1">Será implementado na próxima etapa</p>
          </div>

        </section>

        {/* SEÇÃO 3: TABELA DETALHADA */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Detalhamento de {activeTab === 'marketing' ? 'Campanhas' : 'Contratos'}</h3>
            <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              <FontAwesomeIcon icon={faFileExport} />
              Exportar Relatório
            </button>
          </div>
          <div className="p-12 text-center">
            <p className="text-slate-400">A tabela de dados será carregada aqui...</p>
          </div>
        </section>

      </div>
    </div>
  );
}
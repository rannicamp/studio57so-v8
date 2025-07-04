"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import ContasManager from '../../../components/financeiro/ContasManager';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';

export default function FinanceiroPage() {
  const { setPageTitle } = useLayout();
  const [activeTab, setActiveTab] = useState('lancamentos');
  const supabase = createClient();
  
  const [contas, setContas] = useState([]);

  useEffect(() => {
    setPageTitle('Gestão Financeira');
    
    const fetchContas = async () => {
        const { data } = await supabase.from('contas_financeiras').select('id, nome');
        setContas(data || []);
    };
    fetchContas();
    
  }, [setPageTitle, supabase]);

  const TabButton = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${
        activeTab === tabName
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Painel Financeiro</h1>

      <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
        <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
          <TabButton tabName="dashboard" label="Dashboard" />
          <TabButton tabName="lancamentos" label="Lançamentos" />
          <TabButton tabName="conciliacao" label="Conciliação Bancária" />
          <TabButton tabName="contas" label="Contas" />
          <TabButton tabName="categorias" label="Categorias" />
          <TabButton tabName="relatorios" label="Relatórios" />
        </nav>
      </div>

      <div className="mt-4">
        {activeTab === 'lancamentos' && <LancamentosManager />}
        {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} />}
        {activeTab === 'contas' && <ContasManager />}
        {activeTab === 'categorias' && <CategoriasManager />}
        
        {activeTab === 'dashboard' && (
            <div className="text-center p-10 bg-white rounded-b-lg shadow">
                <p>O Dashboard Financeiro será construído em breve.</p>
            </div>
        )}
         {activeTab === 'relatorios' && (
            <div className="text-center p-10 bg-white rounded-b-lg shadow">
                <p>Os Relatórios Financeiros serão construídos em breve.</p>
            </div>
        )}
      </div>
    </div>
  );
}

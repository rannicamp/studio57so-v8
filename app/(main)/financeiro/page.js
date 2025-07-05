"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { createClient } from '../../../utils/supabase/client';
import ContasManager from '../../../components/financeiro/ContasManager';
import LancamentosManager from '../../../components/financeiro/LancamentosManager';
import CategoriasManager from '../../../components/financeiro/CategoriasManager';
import ConciliacaoManager from '../../../components/financeiro/ConciliacaoManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

export default function FinanceiroPage() {
  const { setPageTitle } = useLayout();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState('lancamentos');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Estados centralizados
  const [contas, setContas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [filtroConciliacao, setFiltroConciliacao] = useState('todos');

  // Função para buscar os lançamentos, agora centralizada
  const fetchLancamentos = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('lancamentos').select('*, conta:contas_financeiras(nome), categoria:categorias_financeiras(nome), favorecido:favorecido_contato_id(nome, razao_social), anexos:lancamentos_anexos(*)').order('data_transacao', { ascending: false });
    
    if (filtroConciliacao === 'conciliado') query = query.eq('conciliado', true);
    else if (filtroConciliacao === 'pendente') query = query.eq('conciliado', false);
    
    const { data, error } = await query;

    if (error) setMessage("Erro ao buscar lançamentos: " + error.message);
    else setLancamentos(data || []);
    setLoading(false);
  }, [supabase, filtroConciliacao]);
  
  // Função para buscar as contas
  const fetchContas = useCallback(async () => {
    const { data } = await supabase.from('contas_financeiras').select('id, nome');
    setContas(data || []);
  }, [supabase]);

  // Efeitos para carregar dados
  useEffect(() => {
    setPageTitle('Gestão Financeira');
    fetchContas();
  }, [setPageTitle, fetchContas]);
  
  useEffect(() => {
      fetchLancamentos();
  }, [fetchLancamentos, filtroConciliacao]);

  const TabButton = ({ tabName, label }) => (
    <button onClick={() => setActiveTab(tabName)} className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Painel Financeiro</h1>
         {activeTab === 'lancamentos' && (
            <div className="flex items-center gap-4">
               <select value={filtroConciliacao} onChange={e => setFiltroConciliacao(e.target.value)} className="p-2 border rounded-md text-sm">
                    <option value="todos">Todos</option>
                    <option value="pendente">Pendentes</option>
                    <option value="conciliado">Conciliados</option>
                </select>
            </div>
         )}
      </div>

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
      
      {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

      <div className="mt-4">
        {activeTab === 'lancamentos' && <LancamentosManager lancamentos={lancamentos} onActionComplete={fetchLancamentos} loading={loading} />}
        {activeTab === 'conciliacao' && <ConciliacaoManager contas={contas} onImportSuccess={fetchLancamentos} />}
        {activeTab === 'contas' && <ContasManager />}
        {activeTab === 'categorias' && <CategoriasManager />}
        
        {activeTab === 'dashboard' && <div className="text-center p-10 bg-white rounded-b-lg shadow"><p>O Dashboard Financeiro será construído em breve.</p></div>}
        {activeTab === 'relatorios' && <div className="text-center p-10 bg-white rounded-b-lg shadow"><p>Os Relatórios Financeiros serão construídos em breve.</p></div>}
      </div>
    </div>
  );
}
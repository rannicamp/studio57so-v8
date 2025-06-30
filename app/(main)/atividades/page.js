"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import AtividadeModal from '../../../components/AtividadeModal';
import ActivityList from '../../../components/ActivityList';
import GanttChart from '../../../components/GanttChart';
import KanbanBoard from '../../../components/KanbanBoard';
import ActivityCalendar from '../../../components/ActivityCalendar';
import KpiCard from '../../../components/KpiCard';
import { useLayout } from '../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faTasks, faUserClock, faHistory } from '@fortawesome/free-solid-svg-icons';

export default function AtividadesPage() {
  const supabase = createClient();
  const { setPageTitle } = useLayout();
  
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedContext, setSelectedContext] = useState('geral');
  const [activities, setActivities] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('kanban');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  
  const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });

  const kpiData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    return {
        atrasadas: activities.filter(act => act.data_fim_prevista && new Date(act.data_fim_prevista) < today && act.status !== 'Concluído').length,
        concluidasNoMes: activities.filter(act => {
            if (act.status !== 'Concluído' || !act.data_fim_real) return false;
            const dataFim = new Date(act.data_fim_real);
            return dataFim.getMonth() === thisMonth && dataFim.getFullYear() === thisYear;
        }).length,
        ativas: activities.filter(act => ['Em Andamento', 'Pausado', 'Aguardando Material'].includes(act.status)).length,
        semResponsavel: activities.filter(act => !act.funcionario_id && act.status !== 'Concluído' && act.status !== 'Cancelado').length,
        reprogramadas: activities.filter(act => act.data_fim_original).length,
    };
  }, [activities]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: empreendimentosData } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').order('nome');
      setEmpreendimentos(empreendimentosData || []);

      const { data: funcData } = await supabase.from('funcionarios').select('id, full_name').order('full_name');
      setFuncionarios(funcData || []);

    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setPageTitle('Painel de Atividades');
    fetchInitialData();
  }, [setPageTitle, fetchInitialData]);

  const fetchActivities = useCallback(async (context) => {
    // **A CORREÇÃO ESTÁ AQUI**: Simplificamos a query para não causar mais o erro de cache.
    let query = supabase.from('activities').select('*');
    
    if (context === 'geral') {
        query = query.is('empreendimento_id', null);
    } else {
        query = query.eq('empreendimento_id', context);
    }
    
    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });
    
    const { data, error } = await query;
    if (error) console.error("Erro ao buscar atividades:", error);
    setActivities(data || []);
  }, [supabase, sortConfig]);

  useEffect(() => {
    fetchActivities(selectedContext);
  }, [selectedContext, fetchActivities]);

  const handleContextChange = (e) => setSelectedContext(e.target.value);
  const handleEditClick = (activity) => { setEditingActivity(activity); setIsModalOpen(true); };
  const handleDeleteClick = async (activityId) => {
    if (window.confirm('Tem certeza que deseja deletar esta atividade?')) {
      const { error } = await supabase.from('activities').delete().eq('id', activityId);
      if (error) alert(`Erro ao deletar: ${error.message}`);
      else {
        alert('Atividade deletada com sucesso!');
        fetchActivities(selectedContext);
      }
    }
  };

  const handleStatusChange = async (activityId, newStatus) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    const updateData = { status: newStatus };

    if (newStatus === 'Em Andamento' && !activity.data_inicio_real) {
        updateData.data_inicio_real = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'Concluído') {
        updateData.data_fim_real = new Date().toISOString().split('T')[0];
    }
    
    const { error } = await supabase.from('activities').update(updateData).eq('id', activityId);
    
    if (error) {
        alert(`Erro ao atualizar o status: ${error.message}`);
    }
    fetchActivities(selectedContext);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const selectedEmpreendimentoObj = useMemo(() => {
    if(selectedContext === 'geral') return null;
    return empreendimentos.find(e => e.id.toString() === selectedContext);
  }, [selectedContext, empreendimentos]);

  const TabButton = ({ tabName, label }) => (
      <button onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{label}</button>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1 w-full">
                <label htmlFor="context-select" className="block text-sm font-medium text-gray-700">Visualizar Atividades de:</label>
                <select id="context-select" onChange={handleContextChange} value={selectedContext} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                    <option value="geral">Tarefas Gerais (sem empreendimento)</option>
                    {empreendimentos.map((emp) => (<option key={emp.id} value={emp.id}>{emp.nome}</option>))}
                </select>
            </div>
            <button onClick={() => handleEditClick(null)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full md:w-auto mt-2 md:mt-0">+ Nova Atividade</button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard title="Atrasadas" value={kpiData.atrasadas} icon={faExclamationTriangle} color="red" />
          <KpiCard title="Ativas" value={kpiData.ativas} icon={faTasks} color="blue" />
          <KpiCard title="Concluídas no Mês" value={kpiData.concluidasNoMes} icon={faCheckCircle} color="green" />
          <KpiCard title="Sem Responsável" value={kpiData.semResponsavel} icon={faUserClock} color="yellow" />
          <KpiCard title="Reprogramadas" value={kpiData.reprogramadas} icon={faHistory} color="purple" />
      </div>

      <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
          <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
              <TabButton tabName="kanban" label="Kanban" />
              <TabButton tabName="list" label="Lista" />
              <TabButton tabName="gantt" label="Gantt" />
              <TabButton tabName="calendar" label="Calendário" />
          </nav>
      </div>

      <div className="mt-4">
        {loading ? <p className="text-center p-10">Carregando atividades...</p> : (
            <>
                {activeTab === 'kanban' && <KanbanBoard activities={activities} onEditActivity={handleEditClick} onStatusChange={handleStatusChange} />}
                {activeTab === 'list' && <ActivityList activities={activities} requestSort={requestSort} sortConfig={sortConfig} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onStatusChange={handleStatusChange} />}
                {activeTab === 'gantt' && <GanttChart activities={activities} />}
                {activeTab === 'calendar' && <ActivityCalendar activities={activities} onActivityClick={handleEditClick} />}
            </>
        )}
      </div>
      
      {isModalOpen && (
        <AtividadeModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingActivity(null); }} onActivityAdded={() => fetchActivities(selectedContext)} activityToEdit={editingActivity} selectedEmpreendimento={selectedEmpreendimentoObj} funcionarios={funcionarios}/>
      )}
    </div>
  );
}
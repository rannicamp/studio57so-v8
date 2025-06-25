"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import AtividadeModal from '../../../components/AtividadeModal';
import ActivityList from '../../../components/ActivityList';
import GanttChart from '../../../components/GanttChart';

export default function AtividadesPage() {
  const supabase = createClient();
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [isGanttCollapsed, setIsGanttCollapsed] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: empreendimentosData, error } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').order('nome');
      if (error) {
        console.error("Erro ao buscar empreendimentos:", error);
      }
      setEmpreendimentos(empreendimentosData || []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchActivities = useCallback(async (empreendimentoId) => {
    if (!empreendimentoId) {
      setActivities([]);
      return;
    }
    const { data, error } = await supabase.from('activities').select('*').eq('empreendimento_id', empreendimentoId).order('data_inicio_prevista');
    if (error) {
        console.error("Erro ao buscar atividades:", error);
    }
    setActivities(data || []);
  }, [supabase]);
  
  const handleEmpreendimentoChange = (e) => {
    const empreendimentoId = e.target.value;
    if (empreendimentoId) {
        const selected = empreendimentos.find(emp => emp.id.toString() === empreendimentoId);
        setSelectedEmpreendimento(selected);
        fetchActivities(empreendimentoId);
    } else {
        setSelectedEmpreendimento(null);
        setActivities([]);
    }
  };

  const sortActivities = useCallback((key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });

    const sorted = [...activities].sort((a, b) => {
        if (a[key] === null || a[key] === undefined) return direction === 'ascending' ? 1 : -1;
        if (b[key] === null || b[key] === undefined) return direction === 'ascending' ? -1 : 1;

        if (typeof a[key] === 'string' && typeof b[key] === 'string') {
            return direction === 'ascending' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        }
        return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
    });
    setActivities(sorted);
  }, [activities, sortConfig]);

  const handleEditClick = (activity) => {
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (activityId) => {
    if (window.confirm('Tem certeza que deseja deletar esta atividade?')) {
      const { error } = await supabase.from('activities').delete().eq('id', activityId);
      if (error) {
        alert(`Erro ao deletar: ${error.message}`);
      } else {
        alert('Atividade deletada com sucesso!');
        fetchActivities(selectedEmpreendimento.id);
      }
    }
  };

  // NOVO: Função para alterar o status diretamente na lista
  const handleStatusChange = async (activityId, newStatus) => {
    // 1. Atualiza a lista na tela imediatamente para o usuário ver a mudança
    setActivities(currentActivities =>
      currentActivities.map(act =>
        act.id === activityId ? { ...act, status: newStatus } : act
      )
    );
    // 2. Envia a atualização para o banco de dados
    const { error } = await supabase
      .from('activities')
      .update({ status: newStatus })
      .eq('id', activityId);
      
    if (error) {
      alert(`Erro ao atualizar o status: ${error.message}`);
      // Se der erro, busca os dados novamente para reverter a mudança na tela
      fetchActivities(selectedEmpreendimento.id);
    }
  };


  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingActivity(null);
  }

  if (loading) {
    return <p className="text-center mt-10">Carregando dados...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h1 className="text-3xl font-bold text-gray-900">Painel de Atividades</h1>
        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="empreendimento-select" className="block text-sm font-medium text-gray-700">Selecione um Empreendimento</label>
            <select id="empreendimento-select" onChange={handleEmpreendimentoChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
              <option value="">-- Escolha um empreendimento --</option>
              {empreendimentos.map((emp) => (<option key={emp.id} value={emp.id}>{emp.nome}</option>))}
            </select>
          </div>
          <button onClick={() => setIsModalOpen(true)} disabled={!selectedEmpreendimento} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
            + Adicionar Atividade
          </button>
        </div>
      </div>

      {selectedEmpreendimento && (
        <>
            <div className="bg-white rounded-lg shadow">
                <button onClick={() => setIsListCollapsed(!isListCollapsed)} className="font-bold text-xl p-4 w-full text-left flex justify-between items-center">
                    <span>Lista de Atividades</span>
                    <span>{isListCollapsed ? '►' : '▼'}</span>
                </button>
                {!isListCollapsed && 
                    <ActivityList 
                        activities={activities} 
                        requestSort={sortActivities} 
                        sortConfig={sortConfig} 
                        onEditClick={handleEditClick} 
                        onDeleteClick={handleDeleteClick}
                        onStatusChange={handleStatusChange} // Passando a nova função
                    />
                }
            </div>
            
            <div className="bg-white rounded-lg shadow">
                <button onClick={() => setIsGanttCollapsed(!isGanttCollapsed)} className="font-bold text-xl p-4 w-full text-left flex justify-between items-center">
                    <span>Gráfico de Gantt</span>
                    <span>{isGanttCollapsed ? '►' : '▼'}</span>
                </button>
                {!isGanttCollapsed && <GanttChart activities={activities} />}
            </div>
        </>
      )}

      {isModalOpen && (
        <AtividadeModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          selectedEmpreendimento={selectedEmpreendimento}
          existingActivities={activities}
          onActivityAdded={() => fetchActivities(selectedEmpreendimento.id)}
          activityToEdit={editingActivity}
        />
      )}
    </div>
  );
}
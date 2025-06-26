"use client";
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import AtividadeModal from '../../../components/AtividadeModal';
import KanbanBoard from '../../../components/KanbanBoard';
import { useLayout } from '../../../contexts/LayoutContext'; // Importe o hook de layout

export default function TarefasGeraisPage() {
  const supabase = createClient();
  const { setPageTitle } = useLayout(); // Use o hook para definir o título
  const [activities, setActivities] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]); // Agora vamos usar a lista de funcionários
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

   // Define o título da página quando o componente é carregado
  useEffect(() => {
     setPageTitle('Gerenciador de Atividades');
  }, [setPageTitle]);


  const fetchActivitiesAndUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('*, responsavel:funcionario_id(full_name)');

      if (activitiesError) throw activitiesError;
      setActivities(activitiesData || []);

      const { data: funcData, error: funcError } = await supabase
        .from('funcionarios')
        .select('id, full_name')
        .order('full_name');

      if (funcError) throw funcError;
      setFuncionarios(funcData || []);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert('Não foi possível carregar os dados. ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchActivitiesAndUsers();
  }, [fetchActivitiesAndUsers]);

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingActivity(null);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        {/* O título foi para o Header, então só o botão fica aqui */}
        <button
          onClick={() => handleEditActivity(null)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600"
        >
          + Nova Atividade
        </button>
      </div>

      {loading ? (
        <p className="text-center mt-10">Carregando quadro de atividades...</p>
      ) : (
        <KanbanBoard
          activities={activities}
          onEditActivity={handleEditActivity}
        />
      )}

      {isModalOpen && (
        <AtividadeModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onActivityAdded={fetchActivitiesAndUsers}
          activityToEdit={editingActivity}
          selectedEmpreendimento={null} // Nulo para tarefas gerais
          funcionarios={funcionarios} // Passa a lista de funcionários
        />
      )}
    </div>
  );
}
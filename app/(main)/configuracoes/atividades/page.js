// app/(main)/configuracoes/atividades/page.js
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faTrash, faPen, faSave, faChevronLeft, faClock, faTasks, faRobot } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import Link from 'next/link';
import SparklesIcon from '@/components/shared/SparklesIcon';

const EVENT_TYPES = ['Reunião', 'Visita', 'Apresentação', 'Follow-up', 'Proposta', 'Outros'];

export default function ConfigAtividadesPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const [selectedEventType, setSelectedEventType] = useState('Visita');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState(null);

  // Form states
  const [nome, setNome] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState('Tarefa');
  const [diasDeslocamento, setDiasDeslocamento] = useState(0);
  const [descricao, setDescricao] = useState('');

  // Fetch das regras cadastradas
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['crm_config_atividades', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data, error } = await supabase
        .from('crm_config_atividades')
        .select('*')
        .eq('organizacao_id', organizacaoId);
      if (error) throw error;
      return data;
    },
    enabled: !!organizacaoId,
  });

  // Mutação para salvar/atualizar
  const saveMutation = useMutation({
    mutationFn: async (updatedList) => {
      const existing = configs.find(c => c.tipo_evento === selectedEventType);
      const payload = {
        organizacao_id: organizacaoId,
        tipo_evento: selectedEventType,
        tarefas_automatizadas: updatedList,
        updated_at: new Date().toISOString()
      };
      if (existing) {
        payload.id = existing.id;
      }
      const { error } = await supabase
        .from('crm_config_atividades')
        .upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm_config_atividades', organizacaoId] });
      toast.success("Configuração salva com sucesso!");
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  });

  const activeConfig = configs.find(c => c.tipo_evento === selectedEventType);
  const subtasks = activeConfig?.tarefas_automatizadas || [];

  const resetForm = () => {
    setNome('');
    setTipoAtividade('Tarefa');
    setDiasDeslocamento(0);
    setDescricao('');
    setEditingSubtask(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subtask, idx) => {
    setEditingSubtask(idx);
    setNome(subtask.nome || '');
    setTipoAtividade(subtask.tipo_atividade || 'Tarefa');
    setDiasDeslocamento(subtask.dias_deslocamento || 0);
    setDescricao(subtask.descricao || '');
    setIsModalOpen(true);
  };

  const handleSaveSubtask = () => {
    if (!nome.trim()) {
      toast.warning("O título da subatividade é obrigatório.");
      return;
    }

    const newSubtask = {
      nome: nome.trim(),
      tipo_atividade: tipoAtividade,
      dias_deslocamento: Number(diasDeslocamento),
      descricao: descricao.trim()
    };

    let updatedList = [...subtasks];
    if (editingSubtask !== null) {
      updatedList[editingSubtask] = newSubtask;
    } else {
      updatedList.push(newSubtask);
    }

    saveMutation.mutate(updatedList);
  };

  const handleDeleteSubtask = (idx) => {
    if (window.confirm("Deseja realmente remover esta subatividade automática?")) {
      const updatedList = subtasks.filter((_, i) => i !== idx);
      saveMutation.mutate(updatedList);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="text-gray-500 hover:text-gray-700 transition-all">
            <FontAwesomeIcon icon={faChevronLeft} size="lg" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <SparklesIcon className="w-6 h-6 animate-pulse" active={true} />
              Automação de Atividades CRM
            </h1>
            <p className="text-xs text-gray-500">Mapeie as subatividades que devem ser criadas automaticamente ao agendar eventos.</p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-102"
        >
          <FontAwesomeIcon icon={faPlus} />
          Nova Subatividade
        </button>
      </header>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tipos de Eventos */}
        <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">Gatilho de Evento</h3>
          <div className="flex flex-col gap-2">
            {EVENT_TYPES.map((type) => {
              const count = configs.find(c => c.tipo_evento === type)?.tarefas_automatizadas?.length || 0;
              const isSelected = selectedEventType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedEventType(type)}
                  className={`w-full text-left p-3 rounded-lg font-medium transition-all flex justify-between items-center ${
                    isSelected ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' : 'bg-transparent text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{type}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subatividades Mapeadas */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
            <FontAwesomeIcon icon={faTasks} className="text-gray-500" />
            Tarefas automáticas para: <span className="text-blue-600">{selectedEventType}</span>
          </h2>

          {subtasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed flex flex-col items-center justify-center">
              <FontAwesomeIcon icon={faTasks} size="3x" className="mb-4 text-gray-300" />
              <p className="font-semibold text-sm">Nenhuma subatividade configurada para este gatilho.</p>
              <p className="text-xs text-gray-400 max-w-xs mt-1">Ao agendar uma {selectedEventType.toLowerCase()} no CRM, nenhuma tarefa extra será criada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subtasks.map((task, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-all flex flex-col justify-between hover:shadow-md bg-white">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                        task.tipo_atividade === 'Evento' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {task.tipo_atividade}
                      </span>
                      <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                        <FontAwesomeIcon icon={faClock} />
                        {task.dias_deslocamento === 0 
                          ? 'No mesmo dia' 
                          : task.dias_deslocamento < 0 
                            ? `${Math.abs(task.dias_deslocamento)} dia(s) antes` 
                            : `${task.dias_deslocamento} dia(s) depois`}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{task.nome}</h4>
                    <p className="text-xs text-gray-500 line-clamp-3 mb-4">{task.descricao || 'Sem descrição cadastrada.'}</p>
                  </div>
                  <div className="flex justify-end gap-2 border-t pt-3 mt-auto">
                    <button
                      onClick={() => handleOpenEdit(task, idx)}
                      className="text-gray-500 hover:text-blue-600 p-1 px-2 rounded hover:bg-gray-100 text-xs flex items-center gap-1 transition-all"
                    >
                      <FontAwesomeIcon icon={faPen} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteSubtask(idx)}
                      className="text-gray-500 hover:text-red-600 p-1 px-2 rounded hover:bg-gray-100 text-xs flex items-center gap-1 transition-all"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={editingSubtask !== null ? faPen : faPlus} className="text-blue-600" />
              {editingSubtask !== null ? 'Editar Subatividade' : 'Nova Subatividade'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título da Atividade *</label>
                <input
                  type="text"
                  placeholder="Ex: Confirmar presença do cliente"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Atividade</label>
                  <select
                    value={tipoAtividade}
                    onChange={(e) => setTipoAtividade(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Tarefa">Tarefa</option>
                    <option value="Evento">Evento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deslocamento (Dias)</label>
                  <input
                    type="number"
                    value={diasDeslocamento}
                    onChange={(e) => setDiasDeslocamento(e.target.value)}
                    placeholder="Ex: -1 para 1 dia antes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">Ex: -1 = dia anterior, 1 = dia seguinte</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                <textarea
                  rows="3"
                  placeholder="Instruções ou roteiro para a execução desta tarefa."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 border-t pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSubtask}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-102"
              >
                <FontAwesomeIcon icon={faSave} />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

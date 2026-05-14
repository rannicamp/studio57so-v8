import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faTimes, faPlus, faSpinner, faToggleOn, faToggleOff, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import AutomacaoModal from './AutomacaoModal';

const fetchAutomations = async (supabase, organizacaoId, funilId) => {
  if (!organizacaoId) return [];
  let query = supabase
    .from('automacoes')
    .select('*')
    .eq('organizacao_id', organizacaoId)
    .order('created_at', { ascending: false });

  // Se funilId for fornecido, filtra. Atualmente exibiremos de todos, ou do funil atual?
  // O usuário está num funil, seria bom ver apenas as dele ou todas? Vamos mostrar todas para facilitar a gestão geral.

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

export default function AutomacoesListModal({ isOpen, onClose, organizacaoId, currentFunilId }) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations', organizacaoId],
    queryFn: () => fetchAutomations(supabase, organizacaoId),
    enabled: isOpen && !!organizacaoId,
  });

  const saveAutomationMutation = useMutation({
    mutationFn: async (automationData) => {
      const { error } = await supabase.from('automacoes').upsert(automationData).select();
      if (error) throw error;
      return automationData.id ? "Automação atualizada!" : "Automação criada!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
      setIsFormModalOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('automacoes').delete().eq('id', id);
      if (error) throw error;
      return "Automação excluída!";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const { error } = await supabase.from('automacoes').update({ ativo: newStatus }).eq('id', id);
      if (error) throw error;
      return `Automação ${newStatus ? 'ativada' : 'desativada'}!`;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
      toast.success(message);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleOpenForm = (automation = null) => {
    setSelectedAutomation(automation);
    setIsFormModalOpen(true);
  };

  const handleDelete = (automation) => {
    toast("Confirmar Exclusão", {
      description: `Tem certeza que deseja excluir a automação "${automation.nome}"?`,
      action: {
        label: "Excluir",
        onClick: () => deleteAutomationMutation.mutate(automation.id),
      },
      cancel: { label: "Cancelar" },
      classNames: { actionButton: 'bg-red-600' }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] flex justify-center items-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faRobot} />
            Automações de WhatsApp
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <h4 className="font-bold text-gray-800 text-base">Suas Automações</h4>
              <p className="text-sm text-gray-500">Regras de envio automático de WhatsApp baseadas na movimentação do Kanban.</p>
            </div>
            <button
              onClick={() => handleOpenForm()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
              Nova Automação
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="p-12 flex justify-center items-center">
                <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-500 text-3xl" />
              </div>
            ) : automations.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                <FontAwesomeIcon icon={faRobot} className="text-4xl text-gray-300" />
                <p className="text-base font-medium">Nenhuma automação cadastrada.</p>
                <p className="text-sm">Crie regras para disparar mensagens de boas-vindas, envio de propostas ou lembretes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome & Gatilho</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Condições (Filtros)</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {automations.map((automation) => {
                      const conds = automation.gatilho_config?.condicoes || {};
                      const hasConds = Object.keys(conds).length > 0;

                      return (
                        <tr key={automation.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900">{automation.nome}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Envia: <span className="font-semibold text-emerald-600">{automation.acao_config?.template_nome}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {!hasConds ? (
                              <span className="text-xs text-gray-400 italic">Dispara sempre</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {conds.tipo && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit">Tipo: {conds.tipo}</span>}
                                {conds.campanha_id && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-fit">Campanha Específica</span>}
                                {conds.origem && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded w-fit">Origem: {conds.origem}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => toggleAutomationMutation.mutate({ id: automation.id, newStatus: !automation.ativo })}>
                              <FontAwesomeIcon
                                icon={automation.ativo ? faToggleOn : faToggleOff}
                                className={`text-2xl ${automation.ativo ? 'text-green-500' : 'text-gray-300'} hover:scale-110 transition-transform`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <button onClick={() => handleOpenForm(automation)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                              <FontAwesomeIcon icon={faPen} />
                            </button>
                            <button onClick={() => handleDelete(automation)} className="text-red-500 hover:text-red-700 transition-colors">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFormModalOpen && (
        <AutomacaoModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSave={(data) => saveAutomationMutation.mutate(data)}
          automation={selectedAutomation}
          supabase={supabase}
          organizacaoId={organizacaoId}
        />
      )}
    </div>
  );
}

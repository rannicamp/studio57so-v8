// components/crm/RodizioConfigModal.js
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faTimes, faSearch, faTrash, faSpinner, faUsers } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function RodizioConfigModal({ isOpen, onClose, organizacaoId }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunilId, setSelectedFunilId] = useState('');
  const [selectedColunaId, setSelectedColunaId] = useState('');

  // Busca os usuários da organização (com contatos vinculados)
  const { data: usuarios = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['usuariosRodizio', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data, error } = await supabase
        .from('usuarios')
        .select(`
          id,
          email,
          nome,
          sobrenome,
          contato_id,
          funcoes(nome_funcao),
          contatos!usuarios_contato_id_fkey(id, nome, razao_social)
        `)
        .eq('organizacao_id', organizacaoId);

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!organizacaoId
  });

  // Busca a configuração atual do rodízio
  const { data: configRodizio, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['configRodizio', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return null;
      const { data, error } = await supabase
        .from('crm_rodizio_config')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!organizacaoId
  });

  // Busca todos os funis da organização
  const { data: funis = [], isLoading: isLoadingFunis } = useQuery({
    queryKey: ['funisRodizio', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data, error } = await supabase
        .from('funis')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId);

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!organizacaoId
  });

  // Busca todas as colunas de todos os funis da organização
  const { data: colunas = [], isLoading: isLoadingColunas } = useQuery({
    queryKey: ['colunasRodizio', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data, error } = await supabase
        .from('colunas_funil')
        .select('id, nome, funil_id')
        .eq('organizacao_id', organizacaoId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!organizacaoId
  });

  // Mutação para salvar as configurações de rodízio
  const saveRodizioMutation = useMutation({
    mutationFn: async ({ novoRodizio, novasColunas }) => {
      const { error } = await supabase
        .from('crm_rodizio_config')
        .upsert({
          organizacao_id: organizacaoId,
          is_active: true,
          fila_usuarios_ids: novoRodizio,
          colunas_rodizio: novasColunas,
          ultimo_indice_atendido: configRodizio?.ultimo_indice_atendido || -1
        }, { onConflict: 'organizacao_id' });

      if (error) throw error;
      return { fila_usuarios_ids: novoRodizio, colunas_rodizio: novasColunas };
    },
    onSuccess: () => {
      toast.success('Rodízio atualizado com sucesso!');
      queryClient.invalidateQueries(['configRodizio', organizacaoId]);
    },
    onError: (error) => {
      toast.error(`Erro ao salvar rodízio: ${error.message}`);
    }
  });

  const toggleRodizioAtivoMutation = useMutation({
    mutationFn: async (isActive) => {
      const { error } = await supabase
        .from('crm_rodizio_config')
        .update({ is_active: isActive })
        .eq('organizacao_id', organizacaoId);
      if (error) throw error;
      return isActive;
    },
    onSuccess: (isActive) => {
      toast.success(isActive ? 'Rodízio ativado!' : 'Rodízio desativado!');
      queryClient.invalidateQueries(['configRodizio', organizacaoId]);
    },
    onError: (error) => {
      toast.error(`Erro ao alterar status: ${error.message}`);
    }
  });

  if (!isOpen) return null;

  const currentListIds = configRodizio?.fila_usuarios_ids || [];
  const activeColumnsList = configRodizio?.colunas_rodizio || [];
  const isActive = configRodizio?.is_active || false;

  const handleToggleUser = (userId) => {
    let newList = [...currentListIds];
    if (newList.includes(userId)) {
      newList = newList.filter(id => id !== userId);
    } else {
      newList.push(userId);
    }
    saveRodizioMutation.mutate({
      novoRodizio: newList,
      novasColunas: activeColumnsList
    });
  };

  const handleAddColunaRodizio = () => {
    if (!selectedColunaId) return;
    if (activeColumnsList.includes(selectedColunaId)) {
      toast.warning('Esta coluna já está no rodízio.');
      return;
    }
    const newList = [...activeColumnsList, selectedColunaId];
    saveRodizioMutation.mutate({
      novoRodizio: currentListIds,
      novasColunas: newList
    });
    setSelectedColunaId('');
  };

  const handleRemoveColunaRodizio = (colId) => {
    const newList = activeColumnsList.filter(id => id !== colId);
    saveRodizioMutation.mutate({
      novoRodizio: currentListIds,
      novasColunas: newList
    });
  };

  const filteredUsers = usuarios.filter(u => {
    if (!searchTerm) {
      // Quando não há pesquisa, exibe apenas quem já está no rodízio
      return currentListIds.includes(u.id);
    }
    // Quando pesquisa, busca na base inteira
    return (`${u.nome || ''} ${u.sobrenome || ''}`).toLowerCase().includes(searchTerm.toLowerCase()) || 
           (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faSync} />
            Configurar Rodízio de Leads
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10" title="Fechar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-gray-50 flex flex-col gap-6">
          
          {/* Status do Rodízio */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                <div>
                   <h4 className="font-bold text-gray-800 text-base">Status do Rodízio Automático</h4>
                   <p className="text-sm text-gray-500">Distribui novos leads sequencialmente entre a lista de corretores ativos.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => toggleRodizioAtivoMutation.mutate(e.target.checked)} />
                   <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
             </div>
          </div>

          {/* Colunas do Rodízio (Configuração Dinâmica) */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
            <div>
              <h4 className="font-bold text-gray-800 text-base">Colunas Ativas para o Rodízio</h4>
              <p className="text-sm text-gray-500">Selecione as colunas onde o rodízio comercial automático (transbordo da Stella) será aplicado.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-600">Funil</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={selectedFunilId}
                  onChange={(e) => {
                    setSelectedFunilId(e.target.value);
                    const colsDoFunil = colunas.filter(c => c.funil_id === e.target.value);
                    setSelectedColunaId(colsDoFunil[0]?.id || '');
                  }}
                  disabled={isLoadingFunis}
                >
                  <option value="">Selecione um funil...</option>
                  {funis.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-600">Coluna</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={selectedColunaId}
                  onChange={(e) => setSelectedColunaId(e.target.value)}
                  disabled={!selectedFunilId || isLoadingColunas}
                >
                  <option value="">Selecione uma coluna...</option>
                  {colunas
                    .filter(c => c.funil_id === selectedFunilId)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddColunaRodizio}
              disabled={!selectedColunaId || saveRodizioMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Adicionar Coluna ao Rodízio
            </button>

            {/* Listagem das colunas configuradas */}
            <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
              <div className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {activeColumnsList.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">
                    Nenhuma coluna customizada configurada. Usando as padrões de sistema (Intervenção Humana e Cliente Potencial).
                  </div>
                ) : (
                  activeColumnsList.map(colId => {
                    const colInfo = colunas.find(c => c.id === colId);
                    const funilInfo = funis.find(f => f.id === colInfo?.funil_id);
                    return (
                      <div key={colId} className="flex justify-between items-center p-3 text-xs bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700">{colInfo?.nome || 'Coluna Desconhecida'}</span>
                          <span className="text-gray-400">Funil: {funilInfo?.nome || 'Desconhecido'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveColunaRodizio(colId)}
                          disabled={saveRodizioMutation.isPending}
                          className="text-red-500 hover:text-red-700 p-1.5 transition-colors disabled:text-gray-300"
                          title="Remover Coluna"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Gerenciar Fila de Corretores */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
            <div>
              <h4 className="font-bold text-gray-800 text-base">Gerenciar Fila ({currentListIds.length} ativos)</h4>
              <p className="text-sm text-gray-500">Adicione os corretores na fila circular na ordem desejada.</p>
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar corretor por nome ou email..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {isLoadingUsers || isLoadingConfig ? (
                  <div className="p-8 flex justify-center items-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-500 text-2xl" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                     <FontAwesomeIcon icon={faUsers} className="text-3xl text-gray-300" />
                     <p className="text-sm font-medium">
                       {searchTerm 
                         ? "Nenhum corretor encontrado na pesquisa." 
                         : "A fila está vazia. Comece a digitar o nome de um corretor para adicionar."}
                     </p>
                  </div>
                ) : (
                  filteredUsers.map(u => {
                    const isInList = currentListIds.includes(u.id);
                    return (
                      <div key={u.id} className={`flex items-center justify-between p-3 transition-colors ${isInList ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-800">{u.nome || ''} {u.sobrenome || ''} {(!u.nome && !u.sobrenome) ? u.email : ''}</span>
                            {u.funcoes?.nome_funcao && (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wider font-bold rounded">
                                {u.funcoes.nome_funcao}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs ${u.contato_id ? 'text-gray-500' : 'text-red-500 font-medium'}`}>
                            {u.contato_id 
                              ? `Contato Vinculado: ${u.contatos?.nome || u.contatos?.razao_social || 'Desconhecido'}`
                              : '⚠️ Sem contato vinculado (Vincule em Configurações > Usuários)'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleUser(u.id)}
                          disabled={!u.contato_id || saveRodizioMutation.isPending}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            !u.contato_id 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isInList 
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          }`}
                        >
                          {isInList ? 'Remover' : 'Adicionar à Fila'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

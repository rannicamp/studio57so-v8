"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, faSpinner, faLock, faPlus, 
  faEdit, faTrash, faFolder, faFolderOpen,
  faSlidersH, faAlignLeft, faListOl
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function EtapasConfigPage() {
  const { setPageTitle } = useLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, loading: authLoading, user } = useAuth();
  const organizacaoId = user?.organizacao_id;
  const supabase = createClient();

  const canView = hasPermission('financeiro', 'pode_ver'); // Utilizando permissão geral do financeiro/obras

  const [etapaSelecionadaId, setEtapaSelecionadaId] = useState(null);

  // Estados para Criação/Edição de Etapa
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState(null);
  const [etapaForm, setEtapaForm] = useState({ nome_etapa: '', codigo_etapa: '', custo_previsto: '' });

  // Estados para Criação/Edição de Subetapa
  const [isSubetapaModalOpen, setIsSubetapaModalOpen] = useState(false);
  const [editingSubetapa, setEditingSubetapa] = useState(null);
  const [subetapaForm, setSubetapaForm] = useState({ nome_subetapa: '', codigo_subetapa: '' });

  useEffect(() => {
    setPageTitle('Configurações de Etapas');
  }, [setPageTitle]);

  // Query: Buscar todas as Etapas
  const { data: etapas = [], isLoading: isLoadingEtapas } = useQuery({
    queryKey: ['config_etapa_obra', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data, error } = await supabase
        .from('etapa_obra')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('nome_etapa');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizacaoId && canView
  });

  // Query: Buscar Subetapas para a Etapa Selecionada
  const { data: subetapas = [], isLoading: isLoadingSubetapas } = useQuery({
    queryKey: ['config_subetapas', etapaSelecionadaId, organizacaoId],
    queryFn: async () => {
      if (!etapaSelecionadaId || !organizacaoId) return [];
      const { data, error } = await supabase
        .from('subetapas')
        .select('*')
        .eq('etapa_id', etapaSelecionadaId)
        .eq('organizacao_id', organizacaoId)
        .order('nome_subetapa');
      if (error) throw error;
      return data || [];
    },
    enabled: !!etapaSelecionadaId && !!organizacaoId && canView
  });

  // --- MUTATIONS: ETAPAS ---
  const saveEtapaMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingEtapa) {
        const { data, error } = await supabase
          .from('etapa_obra')
          .update(payload)
          .eq('id', editingEtapa.id)
          .eq('organizacao_id', organizacaoId)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabase
          .from('etapa_obra')
          .insert({ ...payload, organizacao_id: organizacaoId })
          .select();
        if (error) throw error;
        return data[0];
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_etapa_obra'] });
      toast.success(editingEtapa ? 'Etapa atualizada com sucesso!' : 'Etapa cadastrada com sucesso!');
      setIsEtapaModalOpen(false);
      setEditingEtapa(null);
      setEtapaForm({ nome_etapa: '', codigo_etapa: '', custo_previsto: '' });
    },
    onError: (err) => {
      toast.error(`Erro ao salvar etapa: ${err.message}`);
    }
  });

  const deleteEtapaMutation = useMutation({
    mutationFn: async (id) => {
      // Validação de segurança: impede exclusão de etapa com lançamentos vinculados (passivos já lançados)
      const { count, error: countError } = await supabase
        .from('lancamentos')
        .select('*', { count: 'exact', head: true })
        .eq('etapa_id', id)
        .eq('organizacao_id', organizacaoId);
      
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`Esta etapa possui ${count} lançamento(s) financeiro(s) associado(s). Não é possível excluí-la para preservar a integridade dos passivos lançados.`);
      }

      const { error } = await supabase
        .from('etapa_obra')
        .delete()
        .eq('id', id)
        .eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['config_etapa_obra'] });
      if (etapaSelecionadaId === id) {
        setEtapaSelecionadaId(null);
      }
      toast.success('Etapa excluída com sucesso!');
    },
    onError: (err) => {
      toast.error(`Erro ao excluir etapa: ${err.message}`);
    }
  });

  // --- MUTATIONS: SUBETAPAS ---
  const saveSubetapaMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingSubetapa) {
        const { data, error } = await supabase
          .from('subetapas')
          .update(payload)
          .eq('id', editingSubetapa.id)
          .eq('organizacao_id', organizacaoId)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await supabase
          .from('subetapas')
          .insert({ 
            ...payload, 
            etapa_id: etapaSelecionadaId, 
            organizacao_id: organizacaoId 
          })
          .select();
        if (error) throw error;
        return data[0];
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_subetapas', etapaSelecionadaId] });
      toast.success(editingSubetapa ? 'Subetapa atualizada com sucesso!' : 'Subetapa cadastrada com sucesso!');
      setIsSubetapaModalOpen(false);
      setEditingSubetapa(null);
      setSubetapaForm({ nome_subetapa: '', codigo_subetapa: '' });
    },
    onError: (err) => {
      toast.error(`Erro ao salvar subetapa: ${err.message}`);
    }
  });

  const deleteSubetapaMutation = useMutation({
    mutationFn: async (id) => {
      // Validação de segurança: impede exclusão de subetapa com lançamentos vinculados (passivos já lançados)
      const { count, error: countError } = await supabase
        .from('lancamentos')
        .select('*', { count: 'exact', head: true })
        .eq('subetapa_id', id)
        .eq('organizacao_id', organizacaoId);
      
      if (countError) throw countError;
      if (count && count > 0) {
        throw new Error(`Esta subetapa possui ${count} lançamento(s) financeiro(s) associado(s). Não é possível excluí-la para preservar a integridade dos passivos lançados.`);
      }

      const { error } = await supabase
        .from('subetapas')
        .delete()
        .eq('id', id)
        .eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config_subetapas', etapaSelecionadaId] });
      toast.success('Subetapa excluída com sucesso!');
    },
    onError: (err) => {
      toast.error(`Erro ao excluir subetapa: ${err.message}`);
    }
  });

  // --- HANDLERS ---
  const handleOpenAddEtapa = () => {
    setEditingEtapa(null);
    setEtapaForm({ nome_etapa: '', codigo_etapa: '', custo_previsto: '' });
    setIsEtapaModalOpen(true);
  };

  const handleOpenEditEtapa = (e, etapa) => {
    e.stopPropagation();
    setEditingEtapa(etapa);
    setEtapaForm({
      nome_etapa: etapa.nome_etapa || '',
      codigo_etapa: etapa.codigo_etapa || '',
      custo_previsto: etapa.custo_previsto ? String(etapa.custo_previsto) : ''
    });
    setIsEtapaModalOpen(true);
  };

  const handleDeleteEtapa = (e, id, nome) => {
    e.stopPropagation();
    if (window.confirm(`Deseja realmente excluir a etapa "${nome}"? Isso não apagará as subetapas do banco, mas elas perderão a associação.`)) {
      deleteEtapaMutation.mutate(id);
    }
  };

  const handleOpenAddSubetapa = () => {
    setEditingSubetapa(null);
    setSubetapaForm({ nome_subetapa: '', codigo_subetapa: '' });
    setIsSubetapaModalOpen(true);
  };

  const handleOpenEditSubetapa = (subetapa) => {
    setEditingSubetapa(subetapa);
    setSubetapaForm({
      nome_subetapa: subetapa.nome_subetapa || '',
      codigo_subetapa: subetapa.codigo_subetapa || ''
    });
    setIsSubetapaModalOpen(true);
  };

  const handleDeleteSubetapa = (id, nome) => {
    if (window.confirm(`Deseja realmente excluir a subetapa "${nome}"?`)) {
      deleteSubetapaMutation.mutate(id);
    }
  };

  const submitEtapa = (e) => {
    e.preventDefault();
    if (!etapaForm.nome_etapa.trim()) return toast.warning('Preencha o nome da etapa.');
    saveEtapaMutation.mutate({
      nome_etapa: etapaForm.nome_etapa.trim(),
      codigo_etapa: etapaForm.codigo_etapa.trim() || null,
      custo_previsto: etapaForm.custo_previsto ? parseFloat(etapaForm.custo_previsto) : null
    });
  };

  const submitSubetapa = (e) => {
    e.preventDefault();
    if (!subetapaForm.nome_subetapa.trim()) return toast.warning('Preencha o nome da subetapa.');
    saveSubetapaMutation.mutate({
      nome_subetapa: subetapaForm.nome_subetapa.trim(),
      codigo_subetapa: subetapaForm.codigo_subetapa.trim() || null
    });
  };

  if (authLoading || isLoadingEtapas) {
    return (
      <div className="flex justify-center items-center h-64">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
        <span className="ml-3 text-gray-500 font-semibold">Carregando painel de etapas...</span>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg mt-6">
        <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
        <p className="mt-2 text-red-600">Você não tem permissão para visualizar as configurações de obras.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-red-800 underline">Voltar</button>
      </div>
    );
  }

  const etapaSelecionada = etapas.find(e => e.id === etapaSelecionadaId);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Voltar e Título */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-150">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/configuracoes')} className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-lg">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faListOl} className="text-indigo-500 text-xl" />
              Etapas e Subetapas de Obra
            </h1>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">Gerencie a estrutura hierárquica do planejamento físico-financeiro das suas obras.</p>
          </div>
        </div>
        <button onClick={handleOpenAddEtapa} className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-2.5 px-4 rounded-lg shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2">
          <FontAwesomeIcon icon={faPlus} /> Nova Etapa
        </button>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel de Etapas (Esquerda) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50/70 border-b border-gray-200 p-4">
            <h3 className="font-extrabold text-sm text-gray-700 uppercase tracking-wider">Etapas de Obra ({etapas.length})</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar">
            {etapas.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma etapa cadastrada na organização.
              </div>
            ) : (
              etapas.map(etapa => {
                const isSelected = etapa.id === etapaSelecionadaId;
                return (
                  <div 
                    key={etapa.id} 
                    onClick={() => setEtapaSelecionadaId(etapa.id)}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between group border-l-4 ${
                      isSelected ? 'border-l-indigo-600 bg-indigo-50/40' : 'border-l-transparent hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FontAwesomeIcon 
                        icon={isSelected ? faFolderOpen : faFolder} 
                        className={`text-sm flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} 
                      />
                      <div className="min-w-0">
                        <p className={`font-bold text-[14px] leading-tight truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                          {etapa.nome_etapa}
                        </p>
                        {etapa.codigo_etapa && (
                          <span className="font-mono text-[10px] text-gray-400 mt-0.5 inline-block bg-gray-100 px-1 rounded">
                            Cód: {etapa.codigo_etapa}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleOpenEditEtapa(e, etapa)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                        title="Editar Etapa"
                      >
                        <FontAwesomeIcon icon={faEdit} size="xs" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteEtapa(e, etapa.id, etapa.nome_etapa)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        title="Excluir Etapa"
                      >
                        <FontAwesomeIcon icon={faTrash} size="xs" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Painel de Subetapas (Direita) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[450px]">
          {etapaSelecionada ? (
            <>
              <div className="bg-gray-50/70 border-b border-gray-200 p-4 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Subetapas de:</p>
                  <h3 className="font-extrabold text-sm text-gray-700 truncate max-w-sm sm:max-w-md" title={etapaSelecionada.nome_etapa}>
                    {etapaSelecionada.nome_etapa}
                  </h3>
                </div>
                <button onClick={handleOpenAddSubetapa} className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-extrabold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all duration-200 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faPlus} /> Nova Subetapa
                </button>
              </div>

              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto custom-scrollbar flex-1">
                {isLoadingSubetapas ? (
                  <div className="p-8 text-center text-gray-400">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Carregando subetapas...
                  </div>
                ) : subetapas.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400 border border-dashed border-gray-300">
                      <FontAwesomeIcon icon={faAlignLeft} />
                    </div>
                    <h4 className="text-xs font-bold text-gray-700 mb-1">Nenhuma subetapa vinculada</h4>
                    <p className="text-[11px] text-gray-500 max-w-xs font-medium">Cadastre subetapas nesta etapa para refinar os lançamentos e cronogramas físicos da obra.</p>
                  </div>
                ) : (
                  subetapas.map(sub => (
                    <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-gray-50/40 transition-all group pl-6">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-700 truncate">{sub.nome_subetapa}</p>
                        {sub.codigo_subetapa && (
                          <span className="font-mono text-[10px] text-gray-400 mt-0.5 inline-block bg-gray-100 px-1.5 py-0.5 rounded">
                            Cód: {sub.codigo_subetapa}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEditSubetapa(sub)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                          title="Editar Subetapa"
                        >
                          <FontAwesomeIcon icon={faEdit} size="xs" />
                        </button>
                        <button 
                          onClick={() => handleDeleteSubetapa(sub.id, sub.nome_subetapa)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Excluir Subetapa"
                        >
                          <FontAwesomeIcon icon={faTrash} size="xs" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-16 flex-1 bg-gray-50/20">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-indigo-400 border border-gray-100 shadow-sm">
                <FontAwesomeIcon icon={faSlidersH} className="text-xl" />
              </div>
              <h3 className="text-sm font-extrabold text-gray-700 mb-1">Gerenciador de Estrutura</h3>
              <p className="text-xs text-gray-500 font-semibold max-w-xs leading-relaxed">
                Selecione uma etapa na lista à esquerda para carregar suas respectivas subetapas ou clique em **"Nova Etapa"** no topo.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: ETAPA */}
      {isEtapaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                {editingEtapa ? 'Editar Etapa de Obra' : 'Nova Etapa de Obra'}
              </h3>
              <button onClick={() => setIsEtapaModalOpen(false)} className="text-white/85 hover:text-white font-bold text-sm">Fechar</button>
            </div>
            
            <form onSubmit={submitEtapa} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome da Etapa*</label>
                <input 
                  type="text" 
                  value={etapaForm.nome_etapa}
                  onChange={(e) => setEtapaForm(prev => ({ ...prev, nome_etapa: e.target.value }))}
                  placeholder="Ex: Fundação, Acabamento, Alvenaria" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código (Opcional)</label>
                  <input 
                    type="text" 
                    value={etapaForm.codigo_etapa}
                    onChange={(e) => setEtapaForm(prev => ({ ...prev, codigo_etapa: e.target.value }))}
                    placeholder="Ex: 01.02" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Custo Previsto (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={etapaForm.custo_previsto}
                    onChange={(e) => setEtapaForm(prev => ({ ...prev, custo_previsto: e.target.value }))}
                    placeholder="0,00" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-semibold text-gray-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEtapaModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-500"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saveEtapaMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-extrabold disabled:opacity-50"
                >
                  {saveEtapaMutation.isPending ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBETAPA */}
      {isSubetapaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                {editingSubetapa ? 'Editar Subetapa' : 'Nova Subetapa'}
              </h3>
              <button onClick={() => setIsSubetapaModalOpen(false)} className="text-white/85 hover:text-white font-bold text-sm">Fechar</button>
            </div>
            
            <form onSubmit={submitSubetapa} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome da Subetapa*</label>
                <input 
                  type="text" 
                  value={subetapaForm.nome_subetapa}
                  onChange={(e) => setSubetapaForm(prev => ({ ...prev, nome_subetapa: e.target.value }))}
                  placeholder="Ex: Escavação, Forma de Pilares" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código (Opcional)</label>
                <input 
                  type="text" 
                  value={subetapaForm.codigo_subetapa}
                  onChange={(e) => setSubetapaForm(prev => ({ ...prev, codigo_subetapa: e.target.value }))}
                  placeholder="Ex: 01.02.03" 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsSubetapaModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-500"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saveSubetapaMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-extrabold disabled:opacity-50"
                >
                  {saveSubetapaMutation.isPending ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, faSpinner, faPlus, faSave, faCube, faChevronRight, 
  faRecycle, faTrash, faTimes, faTimesCircle, faFilter, faFileInvoiceDollar,
  faCheckDouble, faSyncAlt
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import BimFileItem from './BimFileItem';
import BimUploadModal from './BimUploadModal';
import BimEditModal from './BimEditModal';
import BimSetModal from './BimSetModal';
import BimDownloadModal from './BimDownloadModal';

export default function BimSidebar({ onSelectContext, onFileSelect, onToggleModel, selectedModels = [], selectedContext, activeUrn, onLoadSet, onClearAll, activeMainTab = 'viewer', setActiveMainTab, isSidebarVisible, onToggleSidebar }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('modelos'); // 'modelos' | 'cenas'
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [filterEmpresaId, setFilterEmpresaId] = useState('');
  const [filterEmpreendimentoId, setFilterEmpreendimentoId] = useState('');
  const [filterDisciplinaId, setFilterDisciplinaId] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // ─── Persistência e Restauração de Filtros (Anti-F5) ───
  const didRestoreFiltersRef = useRef(false);

  useEffect(() => {
    if (didRestoreFiltersRef.current) return;

    try {
      const savedActiveTab = localStorage.getItem('bim_sidebar_activeTab');
      if (savedActiveTab) setActiveTab(savedActiveTab);

      const savedEmpresaId = localStorage.getItem('bim_sidebar_filterEmpresaId');
      if (savedEmpresaId) setFilterEmpresaId(savedEmpresaId);

      const savedEmpreendimentoId = localStorage.getItem('bim_sidebar_filterEmpreendimentoId');
      if (savedEmpreendimentoId) setFilterEmpreendimentoId(savedEmpreendimentoId);

      const savedDisciplinaId = localStorage.getItem('bim_sidebar_filterDisciplinaId');
      if (savedDisciplinaId) setFilterDisciplinaId(savedDisciplinaId);

      const savedSearchTerm = localStorage.getItem('bim_sidebar_searchTerm');
      if (savedSearchTerm) setSearchTerm(savedSearchTerm);

      const savedFiltersExpanded = localStorage.getItem('bim_sidebar_isFiltersExpanded');
      if (savedFiltersExpanded !== null) setIsFiltersExpanded(savedFiltersExpanded === 'true');
    } catch (e) {
      console.warn('[BimSidebar] Erro ao restaurar filtros do localStorage:', e);
    }
    
    didRestoreFiltersRef.current = true;
  }, []);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_filterEmpresaId', filterEmpresaId);
  }, [filterEmpresaId]);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_filterEmpreendimentoId', filterEmpreendimentoId);
  }, [filterEmpreendimentoId]);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_filterDisciplinaId', filterDisciplinaId);
  }, [filterDisciplinaId]);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (!didRestoreFiltersRef.current) return;
    localStorage.setItem('bim_sidebar_isFiltersExpanded', String(isFiltersExpanded));
  }, [isFiltersExpanded]);

  // Estados de Modais
  const [modalState, setModalState] = useState({ upload: false, edit: false, set: false, download: false, mode: 'create', file: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGlobalRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const toastId = toast.loading("Atualizando versões de modelos e quantitativos no banco...");
    try {
      const empId = filterEmpreendimentoId ? Number(filterEmpreendimentoId) : null;
      console.log('[BimSidebar] Disparando refresh de versões para emp:', empId, 'org:', organizacaoId);
      
      const { data, error } = await supabase.rpc('refresh_versoes_projetos_bim', {
        p_empreendimento_id: empId,
        p_organizacao_id: Number(organizacaoId)
      });

      if (error) throw error;

      console.log('[BimSidebar] Retorno do refresh:', data);
      toast.dismiss(toastId);
      toast.success("Modelos e quantitativos atualizados com sucesso!");
      
      // Invalida todos os dados do BIM para forçar o recarregamento na tela
      queryClient.invalidateQueries();
    } catch (err) {
      console.error('[BimSidebar] Erro no refresh global:', err);
      toast.dismiss(toastId);
      toast.error(`Erro ao atualizar modelos: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [supabase, queryClient, filterEmpreendimentoId, organizacaoId, isRefreshing]);

  // Ações do item individual
  const handleFileAction = useCallback((type, file) => {
    if (type === 'sync') {
      onSelectContext({ type: 'sync', file });
    } else if (type === 'version') {
      setModalState({ ...modalState, upload: true, mode: 'version', file });
    } else if (type === 'edit') {
      setModalState({ ...modalState, edit: true, file });
    } else if (type === 'download') {
      setModalState({ ...modalState, download: true, file });
    } else if (type === 'trash') {
      if(confirm(`Mover o arquivo "${file.nome_arquivo}" para a lixeira?`)) moveToTrash(file.id);
    }
  }, [onSelectContext, modalState]);

  // Mutation: Mover para Lixeira
  const { mutate: moveToTrash } = useMutation({
    mutationFn: async (fileId) => {
      const { error } = await supabase.from('projetos_bim').update({ is_lixeira: true }).eq('id', fileId).eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Movido para a lixeira!"); 
      queryClient.invalidateQueries(['bimStructureWithFiles']); 
    },
    onError: (err) => toast.error(`Erro ao mover para a lixeira: ${err.message}`)
  });

  // Mutation: Restaurar da Lixeira
  const { mutate: restoreFromTrash } = useMutation({
    mutationFn: async (fileId) => {
      const { error } = await supabase.from('projetos_bim').update({ is_lixeira: false }).eq('id', fileId).eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Modelo restaurado com sucesso!"); 
      queryClient.invalidateQueries(['bimStructureWithFiles']); 
    },
    onError: (err) => toast.error(`Erro ao restaurar: ${err.message}`)
  });

  // Mutation: Excluir Permanentemente
  const { mutate: deletePermanently } = useMutation({
    mutationFn: async (fileId) => {
      const { error } = await supabase.from('projetos_bim').delete().eq('id', fileId).eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Excluído permanentemente do banco!"); 
      queryClient.invalidateQueries(['bimStructureWithFiles']); 
    },
    onError: (err) => toast.error(`Erro ao excluir permanentemente: ${err.message}`)
  });

  // Mutation: Excluir Set/Cena Federada
  const deleteSetMutation = useMutation({
    mutationFn: async (setId) => {
      const { error } = await supabase.from('bim_vistas_federadas').delete().eq('id', setId).eq('organizacao_id', organizacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cena federada excluída com sucesso!");
      queryClient.invalidateQueries(['bimStructureWithFiles']);
    },
    onError: (err) => toast.error(`Erro ao excluir cena: ${err.message}`)
  });

  // Query principal (estrutura simplificada para lista plana)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bimStructureWithFiles', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return { files: [], sets: [], trash: [], obs: [], discs: [], emps: [] };
      const { data: emps } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obs } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).eq('arquivado', false).order('nome');
      const { data: discs } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
      const { data: files } = await supabase.from('projetos_bim').select('*').eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });
      const { data: sets } = await supabase.from('bim_vistas_federadas').select('*').eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });

      return {
        files: files || [],
        sets: sets || [],
        trash: files?.filter(f => f.is_lixeira) || [],
        obs: obs || [],
        discs: discs || [],
        emps: emps || []
      };
    },
    enabled: !!organizacaoId
  });

  // Enriquecer dados de arquivos ativos (filtrando preventivamente arquivos de empreendimentos arquivados)
  const enrichedFiles = useMemo(() => {
    if (!data?.files) return [];
    return data.files
      .filter(f => !f.is_lixeira)
      .filter(f => {
        // Se o arquivo tem empreendimento associado, este empreendimento deve estar ativo (não arquivado)
        if (f.empreendimento_id && data?.obs) {
          return data.obs.some(o => o.id === f.empreendimento_id);
        }
        return true;
      })
      .map(f => {
        const emp = data.obs?.find(o => o.id === f.empreendimento_id);
        const disc = data.discs?.find(d => d.id === f.disciplina_id);
        return {
          ...f,
          empreendimento_nome: emp ? emp.nome : 'Sem Empreendimento',
          disciplina_sigla: disc ? disc.sigla : 'BIM',
          disciplina_nome: disc ? disc.nome : 'Sem Disciplina'
        };
      });
  }, [data]);

  // Enriquecer dados da lixeira (filtrando preventivamente arquivos de empreendimentos arquivados)
  const enrichedTrash = useMemo(() => {
    if (!data?.trash) return [];
    return data.trash
      .filter(f => {
        if (f.empreendimento_id && data?.obs) {
          return data.obs.some(o => o.id === f.empreendimento_id);
        }
        return true;
      })
      .map(f => {
        const emp = data.obs?.find(o => o.id === f.empreendimento_id);
        const disc = data.discs?.find(d => d.id === f.disciplina_id);
        return {
          ...f,
          empreendimento_nome: emp ? emp.nome : 'Sem Empreendimento',
          disciplina_sigla: disc ? disc.sigla : 'BIM',
          disciplina_nome: disc ? disc.nome : 'Sem Disciplina'
        };
      });
  }, [data]);

  // Enriquecer sets / vistas federadas (filtrando preventivamente sets de empreendimentos arquivados)
  const enrichedSets = useMemo(() => {
    if (!data?.sets) return [];
    return data.sets
      .filter(s => {
        if (s.empreendimento_id && data?.obs) {
          return data.obs.some(o => o.id === s.empreendimento_id);
        }
        return true;
      })
      .map(s => {
        const emp = data.obs?.find(o => o.id === s.empreendimento_id);
        return {
          ...s,
          empreendimento_nome: emp ? emp.nome : 'Sem Empreendimento'
        };
      });
  }, [data]);

  // Filtrar empreendimentos por empresa no seletor
  const empreendimentosFiltrados = useMemo(() => {
    if (!data?.obs) return [];
    if (!filterEmpresaId) return data.obs;
    return data.obs.filter(o => String(o.empresa_proprietaria_id) === String(filterEmpresaId));
  }, [data?.obs, filterEmpresaId]);

  // Busca Inteligente e Filtros Avançados de arquivos
  const filteredFiles = useMemo(() => {
    let result = enrichedFiles;

    if (filterEmpresaId) {
      const empIds = data?.obs?.filter(o => String(o.empresa_proprietaria_id) === String(filterEmpresaId)).map(o => o.id) || [];
      result = result.filter(f => empIds.includes(f.empreendimento_id));
    }

    if (filterEmpreendimentoId) {
      result = result.filter(f => String(f.empreendimento_id) === String(filterEmpreendimentoId));
    }

    if (filterDisciplinaId) {
      result = result.filter(f => String(f.disciplina_id) === String(filterDisciplinaId));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(f => 
        (f.nome_arquivo && f.nome_arquivo.toLowerCase().includes(term)) ||
        (f.disciplina_sigla && f.disciplina_sigla.toLowerCase().includes(term)) ||
        (f.disciplina_nome && f.disciplina_nome.toLowerCase().includes(term)) ||
        (f.empreendimento_nome && f.empreendimento_nome.toLowerCase().includes(term))
      );
    }
    return result;
  }, [enrichedFiles, searchTerm, filterEmpresaId, filterEmpreendimentoId, filterDisciplinaId, data]);

  // Busca e Filtros de sets (cenas federadas)
  const filteredSets = useMemo(() => {
    let result = enrichedSets;

    if (filterEmpresaId) {
      const empIds = data?.obs?.filter(o => String(o.empresa_proprietaria_id) === String(filterEmpresaId)).map(o => o.id) || [];
      result = result.filter(s => empIds.includes(s.empreendimento_id));
    }

    if (filterEmpreendimentoId) {
      result = result.filter(s => String(s.empreendimento_id) === String(filterEmpreendimentoId));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.nome && s.nome.toLowerCase().includes(term)) ||
        (s.empreendimento_nome && s.empreendimento_nome.toLowerCase().includes(term))
      );
    }
    return result;
  }, [enrichedSets, searchTerm, filterEmpresaId, filterEmpreendimentoId, data]);

  const handleDeleteSet = useCallback((setId, nome) => {
    if (confirm(`Deseja realmente excluir a cena federada "${nome}"?`)) {
      deleteSetMutation.mutate(setId);
    }
  }, [deleteSetMutation]);

  const handlePermanentDelete = useCallback((fileId, nome) => {
    if (confirm(`⚠️ ALERTA DE EXCLUSÃO DEFINITIVA!\nDeseja realmente excluir permanentemente "${nome}" do banco de dados? Esta ação NÃO tem volta.`)) {
      deletePermanently(fileId);
    }
  }, [deletePermanently]);

  if (isLoading) {
    return (
      <div className="p-6 text-blue-500 animate-pulse text-xs flex items-center justify-center gap-2 h-40">
        <FontAwesomeIcon icon={faSpinner} spin />
        <span>Carregando modelos BIM...</span>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm">
      
      {/* Cabeçalho */}
      <div className="p-4 border-b border-gray-100 bg-white z-10 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <button 
                onClick={onToggleSidebar}
                className="text-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center p-1 rounded-lg hover:bg-gray-50 active:scale-95"
                title="Colapsar Painel Lateral"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            )}
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Modelos BIM</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handleGlobalRefresh}
              disabled={isRefreshing}
              className="bg-gray-50 border border-gray-250 text-gray-600 hover:text-gray-900 hover:bg-gray-100 p-1.5 px-2 rounded-lg font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1"
              title="Atualizar versões de modelos e limpar lixo no banco de dados"
            >
              <FontAwesomeIcon icon={faSyncAlt} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setModalState({ ...modalState, upload: true, mode: 'create', file: null })} 
              className="bg-blue-600 text-white py-1.5 px-3 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faPlus} /> Novo
            </button>
          </div>
        </div>

        {/* Chaveador de Modo de Visualização */}
        {setActiveMainTab && (
          <div className="bg-gray-100 p-1 rounded-xl border border-gray-200 flex gap-1 items-center">
            <button 
              onClick={() => setActiveMainTab('viewer')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider text-center flex items-center justify-center gap-1.5 ${activeMainTab === 'viewer' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
            >
              <FontAwesomeIcon icon={faCube} className="text-[10px]" />
              <span>3D & Plantas</span>
            </button>
            <button 
              onClick={() => setActiveMainTab('orcamento')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider text-center flex items-center justify-center gap-1.5 ${activeMainTab === 'orcamento' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-[10px]" />
              <span>Orçamento</span>
            </button>
          </div>
        )}

        {/* Painel de Federação Ativa */}
        {selectedModels.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded-xl animate-in slide-in-from-top-1 gap-2">
            <span className="text-[9px] font-extrabold text-blue-800 uppercase shrink-0">
              {selectedModels.length} Selecionado{selectedModels.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setModalState({ ...modalState, set: true })} 
                className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/50 px-2 py-1 rounded-md font-bold text-[9px] uppercase transition-colors shadow-sm"
              >
                <FontAwesomeIcon icon={faSave} className="mr-1" /> Salvar Cena
              </button>
              <button 
                onClick={onClearAll} 
                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 px-2 py-1 rounded-md text-[9px] transition-colors"
                title="Limpar Seleção"
              >
                <FontAwesomeIcon icon={faTimesCircle} />
              </button>
            </div>
          </div>
        )}

        {/* Barra de Busca */}
        <div className="relative">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input 
            type="text" 
            placeholder={isTrashOpen ? "Buscar na lixeira..." : activeTab === 'modelos' ? "Buscar modelos..." : "Buscar cenas..."} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-gray-50 border border-transparent rounded-lg py-2 pl-9 pr-8 text-xs outline-none font-medium focus:bg-white focus:border-blue-400 transition-all shadow-sm placeholder-gray-400" 
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <FontAwesomeIcon icon={faTimes} className="text-xs" />
            </button>
          )}
        </div>

        {/* Filtros Avançados Toggle */}
        {!isTrashOpen && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mt-1 px-1">
              <button 
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)} 
                className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${isFiltersExpanded || filterEmpresaId || filterEmpreendimentoId || filterDisciplinaId ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <FontAwesomeIcon icon={faFilter} className="text-[9px]" /> 
                <span>Filtros</span>
                {(filterEmpresaId || filterEmpreendimentoId || filterDisciplinaId) && (
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full inline-block animate-pulse"></span>
                )}
              </button>
              {(filterEmpresaId || filterEmpreendimentoId || filterDisciplinaId) && (
                <button 
                  onClick={() => { setFilterEmpresaId(''); setFilterEmpreendimentoId(''); setFilterDisciplinaId(''); }} 
                  className="text-[9px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {isFiltersExpanded && (
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col gap-2 mt-1 animate-in slide-in-from-top-1 duration-150">
                {/* Seletor de Empresa */}
                <div>
                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Empresa</label>
                  <select 
                    value={filterEmpresaId} 
                    onChange={(e) => { setFilterEmpresaId(e.target.value); setFilterEmpreendimentoId(''); }}
                    className="w-full bg-white border border-gray-200 rounded-md p-1 px-2 text-[10px] font-bold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer shadow-sm"
                  >
                    <option value="">Todas</option>
                    {(data?.emps || []).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor de Empreendimento */}
                <div>
                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Empreendimento (Obra)</label>
                  <select 
                    value={filterEmpreendimentoId} 
                    onChange={(e) => setFilterEmpreendimentoId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-md p-1 px-2 text-[10px] font-bold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer shadow-sm"
                  >
                    <option value="">Todos</option>
                    {empreendimentosFiltrados.map(ob => (
                      <option key={ob.id} value={ob.id}>{ob.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor de Disciplina */}
                {activeTab === 'modelos' && (
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Disciplina (Projeto)</label>
                    <select 
                      value={filterDisciplinaId} 
                      onChange={(e) => setFilterDisciplinaId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-md p-1 px-2 text-[10px] font-bold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer shadow-sm"
                    >
                      <option value="">Todas</option>
                      {(data?.discs || []).map(d => (
                        <option key={d.id} value={d.id}>{d.sigla} - {d.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Abas Superiores */}
      {!isTrashOpen && (
        <div className="flex border-b bg-gray-50 shrink-0">
          <button 
            onClick={() => { setActiveTab('modelos'); }}
            className={`flex-1 py-3 text-[10px] font-extrabold border-b-2 transition-all text-center uppercase tracking-wider ${activeTab === 'modelos' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Modelos 3D
          </button>
          <button 
            onClick={() => { setActiveTab('cenas'); }}
            className={`flex-1 py-3 text-[10px] font-extrabold border-b-2 transition-all text-center uppercase tracking-wider ${activeTab === 'cenas' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Cenas Federadas
          </button>
        </div>
      )}

      {/* Corpo da Barra Lateral */}
      <div className="flex-1 overflow-y-auto px-3 py-4 bg-gray-50/30 custom-scrollbar">
        
        {isTrashOpen ? (
          /* GAVETA DE LIXEIRA */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <button 
                onClick={() => { setIsTrashOpen(false); setSearchTerm(''); }} 
                className="text-gray-500 hover:text-gray-700 font-extrabold text-[10px] uppercase flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm transition-colors"
              >
                <FontAwesomeIcon icon={faChevronRight} className="rotate-180" /> Voltar
              </button>
              <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Lixeira</span>
            </div>

            {enrichedTrash.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-xl border border-dashed p-4">
                Lixeira vazia.
              </div>
            ) : (
              <div className="space-y-2">
                {enrichedTrash.map(f => (
                  <div key={f.id} className="p-3 bg-white border border-gray-100 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-red-100 transition-colors">
                    <div className="min-w-0 flex-grow">
                      <p className="font-bold text-[11px] text-gray-700 truncate" title={f.nome_arquivo}>{f.nome_arquivo}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 font-semibold">
                        {f.disciplina_sigla} • {f.empreendimento_nome}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => restoreFromTrash(f.id)} 
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Restaurar Modelo"
                      >
                        <FontAwesomeIcon icon={faRecycle} className="text-xs" />
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(f.id, f.nome_arquivo)} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Permanentemente"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'modelos' ? (
          /* ABA 1: MODELOS 3D */
          filteredFiles.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400">
                {searchTerm ? 'Nenhum modelo encontrado.' : 'Nenhum modelo cadastrado.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Seleção em Lote do Filtro Ativo */}
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-150/40 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                <span>{filteredFiles.length} modelo{filteredFiles.length !== 1 ? 's' : ''} filtrado{filteredFiles.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      const concluidos = filteredFiles.filter(f => f.status?.toLowerCase() !== 'erro');
                      if (concluidos.length === 0) {
                        toast.error("Nenhum modelo válido disponível no filtro para carregar.");
                        return;
                      }
                      onLoadSet(concluidos);
                    }}
                    className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50/50 hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-black"
                    title="Selecionar todos os modelos visíveis no filtro"
                  >
                    <FontAwesomeIcon icon={faCheckDouble} className="text-[9px]" />
                    <span>Todos</span>
                  </button>
                  <button 
                    onClick={onClearAll}
                    className="text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 bg-red-50/50 hover:bg-red-50 px-2 py-0.5 rounded border border-red-100 font-black"
                    title="Limpar todos os modelos selecionados"
                  >
                    <FontAwesomeIcon icon={faTimesCircle} className="text-[9px]" />
                    <span>Limpar</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {filteredFiles.map(f => (
                  <BimFileItem 
                    key={f.id} 
                    file={f} 
                    isActive={activeUrn === f.urn_autodesk?.replace(/^urn:/, '')}
                    isSelected={selectedModels.includes(f.urn_autodesk?.replace(/^urn:/, ''))}
                    onFileSelect={onFileSelect} 
                    onToggleModel={onToggleModel}
                    onAction={handleFileAction}
                  />
                ))}
              </div>
            </div>
          )
        ) : (
          /* ABA 2: CENAS FEDERADAS */
          filteredSets.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400">
                {searchTerm ? 'Nenhuma cena encontrada.' : 'Nenhuma cena federada salva.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSets.map(set => {
                const fileIdsDoSet = (set.projetos_ids || []).map(id => String(id));
                const urnsDoSet = data?.files?.filter(f => fileIdsDoSet.includes(String(f.id))).map(f => f.urn_autodesk?.replace(/^urn:/, '')).filter(Boolean) || [];
                const isCenaAtiva = urnsDoSet.length > 0 && urnsDoSet.every(urn => selectedModels.includes(urn));

                return (
                  <div 
                    key={set.id}
                    onClick={() => {
                      const filesDoSet = data.files.filter(f => fileIdsDoSet.includes(String(f.id)));
                      onLoadSet(filesDoSet);
                    }}
                    className={`p-3 cursor-pointer transition-all border rounded-xl flex items-center justify-between group hover:border-blue-200 hover:shadow-sm ${isCenaAtiva ? 'border-l-4 border-l-blue-600 border-blue-200 bg-blue-50/20' : 'border-l-4 border-l-transparent border-gray-100 bg-white'}`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className={`font-bold text-xs truncate leading-tight ${isCenaAtiva ? 'text-blue-900' : 'text-gray-800'}`}>
                        {set.nome}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold truncate mt-1">
                        {set.empreendimento_nome} • {fileIdsDoSet.length} modelo{fileIdsDoSet.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSet(set.id, set.nome);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir Cena"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Lixeira Link no Rodapé */}
      {!isTrashOpen && enrichedTrash.length > 0 && (
        <div className="p-3 border-t border-gray-100 bg-white flex justify-center shrink-0">
          <button 
            onClick={() => setIsTrashOpen(true)}
            className="text-[10px] font-extrabold text-gray-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <FontAwesomeIcon icon={faTrash} /> Lixeira ({enrichedTrash.length})
          </button>
        </div>
      )}

      {/* Modais */}
      <BimUploadModal 
        isOpen={modalState.upload} 
        onClose={() => setModalState({...modalState, upload: false})} 
        preSelectedContext={selectedContext} 
        onSuccess={() => refetch()} 
        mode={modalState.mode} 
        fileToUpdate={modalState.file} 
      />
      <BimEditModal 
        isOpen={modalState.edit} 
        onClose={() => setModalState({...modalState, edit: false})} 
        fileToEdit={modalState.file} 
        onSuccess={() => refetch()} 
      />
      <BimSetModal 
        isOpen={modalState.set} 
        onClose={() => setModalState({...modalState, set: false})} 
        selectedFiles={data?.files?.filter(f => selectedModels.includes(f.urn_autodesk?.replace(/^urn:/, '')))} 
        onSuccess={() => refetch()} 
      />
      <BimDownloadModal
        isOpen={modalState.download}
        onClose={() => setModalState({...modalState, download: false})}
        file={modalState.file}
      />
    </div>
  );
}
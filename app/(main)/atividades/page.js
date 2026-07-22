// app/(main)/atividades/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce'; import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faTasks, faUserClock, faHistory, faLock, faSpinner,
 faSearch,
 faFilter,
 faPlus,
 faSync,
 faClipboardList
} from '@fortawesome/free-solid-svg-icons';

import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { enviarNotificacao } from '@/utils/notificacoes';

import AtividadeModal from '@/components/atividades/AtividadeModal';
import ActivityList from '@/components/atividades/ActivityList';
import GanttChart from '@/components/atividades/GanttChart';
import KanbanBoard from '@/components/atividades/KanbanBoard';
import ActivityCalendar from '@/components/atividades/ActivityCalendar';
import AtividadeFiltros from '@/components/atividades/AtividadeFiltros';
import KpiCard from '@/components/shared/KpiCard';
import AtividadeDetalhesSidebar from '@/components/atividades/AtividadeDetalhesSidebar';

const STORAGE_KEY = 'STUDIO57_ACTIVITIES_UI_V1';

const getCachedUiState = () => {
 if (typeof window === 'undefined') return null;
 try {
 const saved = localStorage.getItem(STORAGE_KEY);
 return saved ? JSON.parse(saved) : null;
 } catch (e) {
 console.error("Erro ao ler cache:", e);
 return null;
 }
};

const fetchAllActivitiesSummary = async (supabase, organizacaoId) => {
  if (!organizacaoId) return [];
  const { data, error } = await supabase
    .from('activities')
    .select('id, nome, status, data_inicio_prevista, data_fim_prevista, data_inicio_real, data_fim_real, data_fim_original, funcionario_id, empreendimento_id, responsavel_texto, atividade_pai_id')
    .eq('organizacao_id', organizacaoId);

  if (error) {
    console.error("Erro ao buscar resumo de atividades:", error);
    throw new Error(error.message);
  }
  return data || [];
};

const fetchPaginatedActivities = async (supabase, organizacaoId, filters, sortConfig, page, limit = 50) => {
  if (!organizacaoId) return { data: [], count: 0 };

  let query = supabase
    .from('activities')
    .select(`
      *,
      empreendimentos(empresa_proprietaria_id, nome),
      anexos:activity_anexos(*),
      atividade_pai:atividade_pai_id(id, nome)
    `, { count: 'exact' })
    .eq('organizacao_id', organizacaoId);

  // Filtro de Empresa (via relacionamento)
  if (filters.empresa) {
    query = query.filter('empreendimentos.empresa_proprietaria_id', 'eq', filters.empresa);
  }

  // Filtro de Empreendimento
  if (filters.empreendimento) {
    query = query.eq('empreendimento_id', filters.empreendimento);
  }

  // Filtro de Responsável
  if (filters.responsavel) {
    query = query.eq('funcionario_id', filters.responsavel);
  }

  // Filtro de Status
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Filtros de Data
  if (filters.startDate) {
    query = query.gte('data_inicio_prevista', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('data_inicio_prevista', filters.endDate);
  }

  // Termo de Busca (Nome ou ID)
  if (filters.searchTerm) {
    const term = filters.searchTerm.trim();
    if (term.startsWith('#')) {
      const idSearch = parseInt(term.replace('#', ''), 10);
      if (!isNaN(idSearch)) {
        query = query.eq('id', idSearch);
      }
    } else {
      query = query.ilike('nome', `%${term}%`);
    }
  }

  // Ordenação
  if (sortConfig && sortConfig.key) {
    const ascending = sortConfig.direction === 'ascending';
    query = query.order(sortConfig.key, { ascending });
  } else {
    query = query.order('data_inicio_prevista', { ascending: true });
  }

  // Paginação
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Erro ao buscar atividades paginadas:", error);
    throw new Error(error.message);
  }

  return {
    data: data || [],
    count: count || 0
  };
};

const fetchAuxiliaryData = async (supabase, organizacaoId) => {
 if (!organizacaoId) return { funcionarios: [], allEmpresas: [] };
 const { data: funcData, error: funcError } = await supabase
 .from('funcionarios')
 .select('id, full_name')
 .eq('organizacao_id', organizacaoId)
 .eq('status', 'Ativo') // Adicionei filtro de ativo por segurança
 .order('full_name');
 const { data: empresasData, error: empresasError } = await supabase
 .from('cadastro_empresa')
 .select('id, razao_social')
 .eq('organizacao_id', organizacaoId)
 .order('razao_social');

 if (funcError || empresasError) console.error("Erro ao carregar dados auxiliares:", { funcError, empresasError });
 return { funcionarios: funcData || [], allEmpresas: empresasData || [] };
};

export default function AtividadesPage() {
 const supabase = createClient();
 const router = useRouter();
 const queryClient = useQueryClient();
 const { setPageTitle } = useLayout();
 const { hasPermission, loading: authLoading, user } = useAuth();
 const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
 const organizacaoId = user?.organizacao_id;

 const canViewPage = hasPermission('atividades', 'pode_ver');
 const canCreate = hasPermission('atividades', 'pode_criar');
 const canEdit = hasPermission('atividades', 'pode_editar');
 const canDelete = hasPermission('atividades', 'pode_excluir');

 const cachedState = getCachedUiState();

 const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'kanban');
 const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);
 const [sortConfig, setSortConfig] = useState(cachedState?.sortConfig || { key: 'data_inicio_prevista', direction: 'ascending' });
 const defaultFilters = { searchTerm: '', empresa: '', empreendimento: '', responsavel: '', status: [], startDate: '', endDate: '' };
 const [filters, setFilters] = useState(cachedState?.filters || defaultFilters);

 // Estados dos Modais e Sidebars
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingActivity, setEditingActivity] = useState(null);
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [selectedActivityForSidebar, setSelectedActivityForSidebar] = useState(null);

 // Estados de Paginação
 const [page, setPage] = useState(1);
 const limit = 50;

 const [debouncedFilters] = useDebounce(filters, 500);

 // Sincroniza o empreendimento global com o filtro local
 useEffect(() => {
   if (selectedEmpreendimento && selectedEmpreendimento !== 'all') {
     setFilters(prev => ({ ...prev, empreendimento: selectedEmpreendimento }));
   } else if (selectedEmpreendimento === 'all') {
     setFilters(prev => ({ ...prev, empreendimento: '' }));
   }
 }, [selectedEmpreendimento]);

 // Reseta para a página 1 ao alterar qualquer filtro
 useEffect(() => {
   setPage(1);
 }, [filters]);

 useEffect(() => {
 if (!authLoading && !canViewPage) router.push('/');
 }, [authLoading, canViewPage, router]);

 useEffect(() => {
 setPageTitle('Painel de Atividades');
 }, [setPageTitle]);

 useEffect(() => {
 if (typeof window !== 'undefined') {
 const stateToSave = {
 activeTab,
 showFilters,
 sortConfig,
 filters: debouncedFilters
 };
 localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
 }
 }, [activeTab, showFilters, sortConfig, debouncedFilters]);

   const { data: allActivitiesSummary = [], isLoading: isLoadingSummary, refetch: refetchSummary, isRefetching: isRefetchingSummary } = useQuery({
      queryKey: ['atividadesSummary', organizacaoId],
      queryFn: () => fetchAllActivitiesSummary(supabase, organizacaoId),
      enabled: !!organizacaoId && canViewPage,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });

   const { data: paginatedData = { data: [], count: 0 }, isLoading: isLoadingPaginated, refetch: refetchPaginated, isRefetching: isRefetchingPaginated } = useQuery({
      queryKey: ['atividadesPaginated', organizacaoId, debouncedFilters, sortConfig, page],
      queryFn: () => fetchPaginatedActivities(supabase, organizacaoId, debouncedFilters, sortConfig, page, limit),
      enabled: !!organizacaoId && canViewPage && activeTab === 'list',
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });
   const paginatedActivities = paginatedData.data;
   const totalCount = paginatedData.count;
   const totalPages = Math.ceil(totalCount / limit);

   const { data: auxiliaryData, refetch: refetchAuxiliaryData } = useQuery({
   queryKey: ['atividadesAuxData', organizacaoId],
   queryFn: () => fetchAuxiliaryData(supabase, organizacaoId),
   enabled: !!organizacaoId && canViewPage,
   staleTime: Infinity,
   refetchOnWindowFocus: false,
   });
   const { funcionarios = [], allEmpresas = [] } = auxiliaryData || {};

 const deleteMutation = useMutation({
  mutationFn: async (activityId) => {
  const { data: act } = await supabase.from('activities').select('nome').eq('id', activityId).single();
  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) throw new Error(error.message);
  return { activityId, nome: act?.nome };
  },
  onSuccess: async (data) => {
  await enviarNotificacao({
  userId: user.id,
  titulo: "🗑️ Atividade Excluída",
  mensagem: `A atividade "${data.nome || 'Desconhecida'}" foi removida.`,
  link: '/atividades',
  organizacaoId: organizacaoId,
  canal: 'operacional'
  });
  toast.success('Atividade deletada com sucesso!');
  queryClient.invalidateQueries({ queryKey: ['atividadesSummary', organizacaoId] });
  queryClient.invalidateQueries({ queryKey: ['atividadesPaginated'] });
  setIsSidebarOpen(false);
  },
  onError: (error) => toast.error(`Erro ao deletar: ${error.message}`)
  });

  const duplicateMutation = useMutation({
  mutationFn: async (activityToDuplicate) => {
  const { id, created_at, updated_at, empreendimentos, anexos, atividade_pai, ...newActivityData } = activityToDuplicate;
  newActivityData.nome = `${activityToDuplicate.nome} (Cópia)`;
  newActivityData.status = 'Não Iniciado'; // Ajustado para corresponder ao padrão do frontend
  newActivityData.data_inicio_real = null;
  newActivityData.data_fim_real = null;
  newActivityData.data_fim_original = null;
  newActivityData.criado_por_usuario_id = user?.id;
  const { error } = await supabase.from('activities').insert(newActivityData);
  if (error) throw new Error(error.message);
  },
  onSuccess: () => {
  toast.success("Atividade duplicada com sucesso!");
  queryClient.invalidateQueries({ queryKey: ['atividadesSummary', organizacaoId] });
  queryClient.invalidateQueries({ queryKey: ['atividadesPaginated'] });
  },
  onError: (error) => toast.error(`Erro ao duplicar: ${error.message}`)
  });

  const statusMutation = useMutation({
  mutationFn: async ({ activityId, newStatus, activity }) => {
  const updateData = { status: newStatus };
  if (newStatus === 'Em Andamento' && !activity.data_inicio_real) {
  updateData.data_inicio_real = new Date().toISOString().split('T')[0]; }
  if (newStatus === 'Concluído') {
  updateData.data_fim_real = new Date().toISOString().split('T')[0]; }
  const { error } = await supabase.from('activities').update(updateData).eq('id', activityId);
  if (error) throw new Error(error.message);
  return { activity, newStatus };
  },
  onSuccess: async (data) => {
  queryClient.invalidateQueries({ queryKey: ['atividadesSummary', organizacaoId] });
  queryClient.invalidateQueries({ queryKey: ['atividadesPaginated'] });
  },
  onError: (error) => toast.error(`Erro ao atualizar status: ${error.message}`)
  });

 const filteredActivities = useMemo(() => {
   return allActivitiesSummary
   .filter(act => {
   if (filters.searchTerm) {
   const term = filters.searchTerm.toLowerCase();
   const matchesName = act.nome?.toLowerCase().includes(term);
   const matchesId = act.id.toString().includes(term);
   const parentName = act.atividade_pai_id ? allActivitiesSummary.find(p => p.id === act.atividade_pai_id)?.nome?.toLowerCase() : null;
   const matchesParent = parentName?.includes(term);
   if (!matchesName && !matchesId && !matchesParent) return false;
   }
   if (filters.empresa) {
   const emp = empreendimentos.find(e => e.id == act.empreendimento_id);
   if (!emp || emp.empresa_proprietaria_id != filters.empresa) return false;
   }
   if (filters.empreendimento && act.empreendimento_id != filters.empreendimento) return false;
   if (filters.responsavel && act.funcionario_id != filters.responsavel) return false;
   if (filters.status.length > 0 && !filters.status.includes(act.status)) return false;
   if (filters.startDate || filters.endDate) {
   if (!act.data_inicio_prevista) return false;
   const actStart = act.data_inicio_prevista;
   const actEnd = act.data_fim_prevista || act.data_inicio_prevista;
   if (filters.startDate && actEnd < filters.startDate) return false;
   if (filters.endDate && actStart > filters.endDate) return false;
   }
   return true;
   })
   .sort((a, b) => {
   if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
   if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
   return 0;
   });
   }, [allActivitiesSummary, filters, sortConfig, empreendimentos]);

 const kpiData = useMemo(() => {
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const thisMonth = today.getMonth();
 const thisYear = today.getFullYear();

 return {
 atrasadas: filteredActivities.filter(act => act.data_fim_prevista && new Date(act.data_fim_prevista) < today && act.status !== 'Concluído').length,
 concluidasNoMes: filteredActivities.filter(act => {
 if (act.status !== 'Concluído' || !act.data_fim_real) return false;
 const dataFim = new Date(act.data_fim_real);
 return dataFim.getMonth() === thisMonth && dataFim.getFullYear() === thisYear;
 }).length,
 ativas: filteredActivities.filter(act => ['Em Andamento', 'Pausado', 'Aguardando Material'].includes(act.status)).length,
 semResponsavel: filteredActivities.filter(act => !act.funcionario_id && act.status !== 'Concluído' && act.status !== 'Cancelado').length,
 reprogramadas: filteredActivities.filter(act => act.data_fim_original).length,
 };
 }, [filteredActivities]);

 const selectedEmpreendimentoObj = useMemo(() => {
 if(!selectedEmpreendimento || selectedEmpreendimento === 'all') return null;
 return empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);
 }, [selectedEmpreendimento, empreendimentos]);

 const handleDuplicateActivity = (act) => {
 if (!canCreate) { toast.error("Sem permissão."); return; }
 toast("Confirmar Duplicação", {
 description: `Duplicar "${act.nome}"?`,
 action: { label: "Duplicar", onClick: () => duplicateMutation.mutate(act) },
 cancel: { label: "Cancelar" }
 });
 };

 const handleDeleteClick = (id) => {
 toast("Confirmar Exclusão", {
 description: 'Deletar esta atividade?',
 action: { label: "Deletar", onClick: () => deleteMutation.mutate(id) },
 cancel: { label: "Cancelar" },
 classNames: { actionButton: 'bg-red-600' }
 });
 };

 const handleStatusChange = (id, status) => {
 const act = allActivitiesSummary.find(a => a.id === id);
 if (act) statusMutation.mutate({ activityId: id, newStatus: status, activity: act });
 };

 const handleCardClick = (act) => { setSelectedActivityForSidebar(act); setIsSidebarOpen(true); };
 const handleEditClick = (act) => { setEditingActivity(act); setIsModalOpen(true); setIsSidebarOpen(false); };
 const requestSort = (key) => {
 let direction = 'ascending';
 if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
 setSortConfig({ key, direction });
 };

 const handleFilterChange = (name, value) => {
 setFilters(prev => ({ ...prev, [name]: value }));
 };

 const clearFilters = () => {
 setFilters({ searchTerm: '', empresa: '', empreendimento: '', responsavel: '', status: [], startDate: '', endDate: '' });
 };

 const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetchSummary(),
        refetchPaginated(),
        refetchAuxiliaryData()
      ]),
      {
        loading: 'Atualizando painel de atividades...',
        success: 'Atividades e dados atualizados!',
        error: 'Erro ao atualizar dados.'
      }
    );
  };

 const TabButton = ({ tabName, label }) => (
 <button onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}
 >
 {label}
 </button>
 );

 if (authLoading || (isLoadingSummary && !allActivitiesSummary.length)) {
 return (
 <div className="flex flex-col items-center justify-center h-64 text-gray-500">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-4 text-blue-500" /> <p>Carregando atividades...</p>
 </div>
 );
 }
 if (!canViewPage) {
 return (
 <div className="flex flex-col items-center justify-center h-64 text-red-600">
 <FontAwesomeIcon icon={faLock} size="3x" className="mb-4" /> <p className="font-semibold">Acesso Negado</p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <AtividadeDetalhesSidebar
 open={isSidebarOpen}
 onClose={() => setIsSidebarOpen(false)}
 activity={selectedActivityForSidebar}
 onEditActivity={handleEditClick}
 />

 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-lg shadow-sm">
 <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          {selectedEmpreendimentoObj?.nome || 'Todas as Atividades'}
        </h2>
        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-2">
          {activeTab === 'list' ? `${paginatedActivities.length} de ${totalCount}` : `${filteredActivities.length} de ${allActivitiesSummary.length}`} atividades
        </span>
 </div>

 <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
 <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
 </div>
 <input type="text" placeholder="Buscar atividade..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
 />
 </div>

  <button onClick={handleManualRefresh} disabled={isRefetchingSummary || isRefetchingPaginated} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 disabled:opacity-75 disabled:cursor-not-allowed"
  title="Atualizar dados do painel"
  >
  <FontAwesomeIcon icon={faSync} className={`mr-2 ${(isRefetchingSummary || isRefetchingPaginated) ? 'animate-spin' : ''}`} />
  Atualizar
  </button>

  <button onClick={() => setShowFilters(!showFilters)} className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
  title="Filtros Avançados"
  >
  <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} />
  Filtros
  </button>

  {canCreate && (
 <button onClick={() => handleEditClick(null)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
 >
 <FontAwesomeIcon icon={faPlus} className="mr-2" /> Nova Atividade
 </button>
 )}
 </div>
 </div>

 {showFilters && (
 <AtividadeFiltros filters={filters} onChange={handleFilterChange} onClear={clearFilters} listas={{ funcionarios, allEmpresas, empreendimentos }} />
 )}

 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 <KpiCard title="Todas as Atividades" value={allActivitiesSummary.length} icon={faClipboardList} />
 <KpiCard title="Atrasadas" value={kpiData.atrasadas} icon={faExclamationTriangle} color="red" />
 <KpiCard title="Em Andamento" value={kpiData.ativas} icon={faTasks} color="blue" />
 <KpiCard title="Concluídas no Mês" value={kpiData.concluidasNoMes} icon={faCheckCircle} color="green" />
 <KpiCard title="Sem Responsável" value={kpiData.semResponsavel} icon={faUserClock} color="yellow" />
 <KpiCard title="Reprogramadas" value={kpiData.reprogramadas} icon={faHistory} color="purple" />
 </div>

 <div className="bg-white shadow-sm rounded-lg border border-gray-200">
 <div className="border-b border-gray-200">
 <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
 <TabButton tabName="kanban" label="Kanban" />
 <TabButton tabName="list" label="Lista" />
 <TabButton tabName="gantt" label="Gantt" />
 <TabButton tabName="calendar" label="Calendário" />
 </nav>
 </div>

 <div className="p-4 bg-gray-50 min-h-[500px]">
  {(isLoadingSummary && !allActivitiesSummary.length) ? (
  <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>
  ) : (
  <>
  {activeTab === 'kanban' && (
  <KanbanBoard activities={filteredActivities} empreendimentos={empreendimentos} onEditActivity={handleCardClick} onStatusChange={handleStatusChange} canEdit={canEdit} onDeleteActivity={handleDeleteClick} onDuplicateActivity={handleDuplicateActivity} />
  )}
  {activeTab === 'list' && (
  <div className="space-y-4">
    {isLoadingPaginated && !paginatedActivities.length ? (
      <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-500">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-4 text-blue-500" />
        Carregando página...
      </div>
    ) : (
      <>
        <ActivityList activities={paginatedActivities} empreendimentos={empreendimentos} requestSort={requestSort} sortConfig={sortConfig} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onDuplicateClick={handleDuplicateActivity} onStatusChange={handleStatusChange} canEdit={canEdit} canDelete={canDelete} canCreate={canCreate} />
        
        {/* Controles de Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
            <span className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{(page - 1) * limit + 1}</span> a{' '}
              <span className="font-semibold">{Math.min(page * limit, totalCount)}</span> de{' '}
              <span className="font-semibold">{totalCount}</span> atividades
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm font-semibold text-gray-700">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
  )}
  {activeTab === 'gantt' && (
  <GanttChart activities={filteredActivities} onEditActivity={handleEditClick} />
  )}
  {activeTab === 'calendar' && (
  <ActivityCalendar activities={filteredActivities} onActivityClick={handleCardClick} />
  )}
  </>
  )}
 </div>
 </div>

 {isModalOpen && (
 <AtividadeModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingActivity(null); }} onActivityAdded={() => { queryClient.invalidateQueries({ queryKey: ['atividadesSummary', organizacaoId] }); queryClient.invalidateQueries({ queryKey: ['atividadesPaginated'] }); }} activityToEdit={editingActivity} selectedEmpreendimento={selectedEmpreendimentoObj} funcionarios={funcionarios} allEmpreendimentos={empreendimentos}
 allEmpresas={allEmpresas}
 />
 )}

 </div>
  );
}
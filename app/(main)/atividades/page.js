// app/(main)/atividades/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import AtividadeModal from '../../../components/atividades/AtividadeModal';
import ActivityList from '../../../components/atividades/ActivityList';
import GanttChart from '../../../components/atividades/GanttChart';
import KanbanBoard from '../../../components/atividades/KanbanBoard';
import ActivityCalendar from '../../../components/atividades/ActivityCalendar';
import AtividadeFiltros from '../../../components/atividades/AtividadeFiltros';
import KpiCard from '../../../components/KpiCard';
import AtividadeDetalhesSidebar from '@/components/atividades/AtividadeDetalhesSidebar';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faTasks, faUserClock, faHistory, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
// 1. IMPORTAÇÃO DO CARTEIRO
import { enviarNotificacao } from '@/utils/notificacoes';

const ACTIVITIES_UI_STATE_KEY = 'atividadesUiState';

const fetchAllActivities = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('activities')
        .select('*, empreendimentos(empresa_proprietaria_id), anexos:activity_anexos(*), atividade_pai:atividade_pai_id(id, nome)')
        .eq('organizacao_id', organizacaoId);

    if (error) {
        console.error("Erro ao buscar todas as atividades:", error);
        throw new Error(error.message);
    }
    return data || [];
};

const fetchAuxiliaryData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { funcionarios: [], allEmpresas: [] };
    const { data: funcData, error: funcError } = await supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacaoId).order('full_name');
    const { data: empresasData, error: empresasError } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacaoId).order('razao_social');

    if (funcError || empresasError) console.error("Erro ao carregar dados auxiliares:", { funcError, empresasError });
    return { funcionarios: funcData || [], allEmpresas: empresasData || [] };
};

export default function AtividadesPage() {
    const supabase = createClient();
    const router = useRouter();
    const { hasPermission, loading: authLoading, user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const queryClient = useQueryClient();

    const canViewPage = hasPermission('atividades', 'pode_ver');
    const canCreate = hasPermission('atividades', 'pode_criar');
    const canEdit = hasPermission('atividades', 'pode_editar');
    const canDelete = hasPermission('atividades', 'pode_excluir');
    
    const [activeTab, setActiveTab] = useState('kanban');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedActivityForSidebar, setSelectedActivityForSidebar] = useState(null);

    const [filters, setFilters] = useState({ 
        searchTerm: '', 
        empresa: '', 
        empreendimento: '', 
        responsavel: '', 
        status: [], 
        startDate: '', 
        endDate: '' 
    });

    useEffect(() => {
        if (!authLoading && !canViewPage) router.push('/');
    }, [authLoading, canViewPage, router]);

    useEffect(() => {
        setPageTitle('Painel de Atividades');
        try {
            const savedFilters = localStorage.getItem('atividadesFilters');
            if (savedFilters) {
                const parsedFilters = JSON.parse(savedFilters);
                if (!Array.isArray(parsedFilters.status)) parsedFilters.status = [];
                if (parsedFilters.selectedDate) { delete parsedFilters.selectedDate; }
                setFilters(parsedFilters);
            }
            const savedUiState = JSON.parse(localStorage.getItem(ACTIVITIES_UI_STATE_KEY) || '{}');
            if (savedUiState && savedUiState.activeTab) setActiveTab(savedUiState.activeTab);
        } catch (error) {
            console.error("Falha ao carregar estado", error);
        }
    }, [setPageTitle]);

    useEffect(() => {
        try {
            localStorage.setItem('atividadesFilters', JSON.stringify(filters));
        } catch (error) {
            console.error("Falha ao salvar filtros", error);
        }
    }, [filters]);

    useEffect(() => {
        try {
            const uiState = { activeTab };
            localStorage.setItem(ACTIVITIES_UI_STATE_KEY, JSON.stringify(uiState));
        } catch (error) {
            console.error("Falha ao salvar UI", error);
        }
    }, [activeTab]);

    const { data: allActivities = [], isLoading: isLoadingActivities } = useQuery({
        queryKey: ['atividades', organizacaoId],
        queryFn: () => fetchAllActivities(supabase, organizacaoId),
        enabled: !!organizacaoId && canViewPage,
    });

    const { data: auxiliaryData } = useQuery({
        queryKey: ['atividadesAuxData', organizacaoId],
        queryFn: () => fetchAuxiliaryData(supabase, organizacaoId),
        enabled: !!organizacaoId && canViewPage,
        staleTime: 300000,
    });
    const { funcionarios = [], allEmpresas = [] } = auxiliaryData || {};

    // --- MUTAÇÃO DE EXCLUIR ---
    const deleteMutation = useMutation({
        mutationFn: async (activityId) => {
            // Busca o nome antes de deletar para a notificação
            const { data: act } = await supabase.from('activities').select('nome').eq('id', activityId).single();
            const { error } = await supabase.from('activities').delete().eq('id', activityId);
            if (error) throw new Error(error.message);
            return { activityId, nome: act?.nome };
        },
        onSuccess: async (data) => {
            // 2. NOTIFICAÇÃO DE EXCLUSÃO 🔔
            await enviarNotificacao({
                userId: user.id,
                titulo: "🗑️ Atividade Excluída",
                mensagem: `A atividade "${data.nome || 'Desconhecida'}" foi removida.`,
                link: '/atividades',
                organizacaoId: organizacaoId,
                canal: 'operacional'
            });

            toast.success('Atividade deletada com sucesso!');
            queryClient.invalidateQueries(['atividades', organizacaoId]);
            setIsSidebarOpen(false);
        },
        onError: (error) => toast.error(`Erro ao deletar: ${error.message}`)
    });

    const duplicateMutation = useMutation({
        mutationFn: async (activityToDuplicate) => {
            const { id, created_at, updated_at, empreendimentos, anexos, atividade_pai, ...newActivityData } = activityToDuplicate;
            newActivityData.nome = `${activityToDuplicate.nome} (Cópia)`;
            newActivityData.status = 'Não Iniciado';
            newActivityData.data_inicio_real = null;
            newActivityData.data_fim_real = null;
            newActivityData.data_fim_original = null;
            newActivityData.criado_por_usuario_id = user?.id;
            
            const { error } = await supabase.from('activities').insert(newActivityData);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Atividade duplicada com sucesso!");
            queryClient.invalidateQueries(['atividades', organizacaoId]);
        },
        onError: (error) => toast.error(`Erro ao duplicar: ${error.message}`)
    });

    // --- MUTAÇÃO DE STATUS (KANBAN) ---
    const statusMutation = useMutation({
        mutationFn: async ({ activityId, newStatus, activity }) => {
            const updateData = { status: newStatus };
            if (newStatus === 'Em Andamento' && !activity.data_inicio_real) {
                updateData.data_inicio_real = new Date().toISOString().split('T')[0]; 
            }
            if (newStatus === 'Concluído') {
                updateData.data_fim_real = new Date().toISOString().split('T')[0]; 
            }
            const { error } = await supabase.from('activities').update(updateData).eq('id', activityId);
            if (error) throw new Error(error.message);
            return { activity, newStatus };
        },
        onSuccess: async (data) => {
            // 3. NOTIFICAÇÃO DE MUDANÇA DE STATUS 🔔
            await enviarNotificacao({
                userId: user.id, // Poderia ser o dono da atividade (activity.criado_por_usuario_id)
                titulo: "🔄 Status Atualizado",
                mensagem: `"${data.activity.nome}" mudou para: ${data.newStatus}`,
                link: '/atividades',
                organizacaoId: organizacaoId,
                canal: 'operacional'
            });

            queryClient.invalidateQueries(['atividades', organizacaoId]);
        },
        onError: (error) => toast.error(`Erro ao atualizar status: ${error.message}`)
    });

    const filteredActivities = useMemo(() => {
        return allActivities
            .filter(act => {
                if (selectedEmpreendimento !== 'all' && act.empreendimento_id != selectedEmpreendimento) return false;
                if (filters.searchTerm) {
                    const term = filters.searchTerm.toLowerCase();
                    const matchesName = act.nome?.toLowerCase().includes(term);
                    const matchesId = act.id.toString().includes(term);
                    const matchesParent = act.atividade_pai?.nome?.toLowerCase().includes(term);
                    if (!matchesName && !matchesId && !matchesParent) return false;
                }
                if (filters.empresa && (!act.empreendimentos || act.empreendimentos.empresa_proprietaria_id != filters.empresa)) return false;
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
    }, [selectedEmpreendimento, allActivities, filters, sortConfig]);

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
        const act = allActivities.find(a => a.id === id);
        if (act) statusMutation.mutate({ activityId: id, newStatus: status, activity: act });
    };

    const handleCardClick = (act) => { setSelectedActivityForSidebar(act); setIsSidebarOpen(true); };
    const handleEditClick = (act) => { setEditingActivity(act); setIsModalOpen(true); setIsSidebarOpen(false); };
    
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const selectedEmpreendimentoObj = useMemo(() => {
        if(!selectedEmpreendimento || selectedEmpreendimento === 'all') return null;
        return empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);
    }, [selectedEmpreendimento, empreendimentos]);

    const TabButton = ({ tabName, label }) => (
        <button onClick={() => setActiveTab(tabName)} className={`${activeTab === tabName ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm`}>{label}</button>
    );

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ searchTerm: '', empresa: '', empreendimento: '', responsavel: '', status: [], startDate: '', endDate: '' });
        localStorage.removeItem('atividadesFilters');
    };

    if (authLoading || (isLoadingActivities && !allActivities.length)) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    if (!canViewPage) return <div className="text-center p-10 text-red-600"><FontAwesomeIcon icon={faLock} size="3x" /> Acesso Negado</div>;

    return (
        <div className="space-y-6">
            <AtividadeDetalhesSidebar
                open={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                activity={selectedActivityForSidebar}
                onEditActivity={handleEditClick}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold">
                    {selectedEmpreendimentoObj?.nome || 'Todas as Atividades'}
                </h2>
                {canCreate && (
                    <button onClick={() => handleEditClick(null)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full md:w-auto">+ Nova Atividade</button>
                )}
            </div>

            <AtividadeFiltros 
                filters={filters} 
                onChange={handleFilterChange} 
                onClear={clearFilters} 
                listas={{ funcionarios, allEmpresas, empreendimentos }} 
            />

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
                {(isLoadingActivities && !allActivities.length) ? <p className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin /> Carregando atividades...</p> : (
                    <>
                        {activeTab === 'kanban' && <KanbanBoard activities={filteredActivities} onEditActivity={handleCardClick} onStatusChange={handleStatusChange} canEdit={canEdit} onDeleteActivity={handleDeleteClick} onDuplicateActivity={handleDuplicateActivity} />}
                        {activeTab === 'list' && <ActivityList activities={filteredActivities} requestSort={requestSort} sortConfig={sortConfig} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onStatusChange={handleStatusChange} canEdit={canEdit} canDelete={canDelete} />}
                        {activeTab === 'gantt' && <GanttChart activities={filteredActivities} onEditActivity={handleEditClick} />}
                        {activeTab === 'calendar' && <ActivityCalendar activities={filteredActivities} onActivityClick={handleCardClick} />}
                    </>
                )}
            </div>

            {isModalOpen && (
                <AtividadeModal 
                    isOpen={isModalOpen} 
                    onClose={() => { setIsModalOpen(false); setEditingActivity(null); }} 
                    onActivityAdded={() => queryClient.invalidateQueries(['atividades', organizacaoId])} 
                    activityToEdit={editingActivity} 
                    selectedEmpreendimento={selectedEmpreendimentoObj} 
                    funcionarios={funcionarios} 
                    allEmpreendimentos={empreendimentos}
                    allEmpresas={allEmpresas}
                />
            )}
        </div>
    );
}
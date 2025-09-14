// app/(main)/atividades/page.js

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import AtividadeModal from '../../../components/AtividadeModal';
import ActivityList from '../../../components/ActivityList';
import GanttChart from '../../../components/GanttChart';
import KanbanBoard from '../../../components/KanbanBoard';
import ActivityCalendar from '../../../components/ActivityCalendar';
import KpiCard from '../../../components/KpiCard';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faTasks, faUserClock, faHistory, faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../../../components/financeiro/MultiSelectDropdown';
import { toast } from 'sonner';
import AtividadeDetalhesSidebar from '@/components/atividades/AtividadeDetalhesSidebar';

export default function AtividadesPage() {
    const supabase = createClient();
    const router = useRouter();
    const { hasPermission, loading: authLoading, user } = useAuth();
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();

    const canViewPage = hasPermission('atividades', 'pode_ver');
    const canCreate = hasPermission('atividades', 'pode_criar');
    const canEdit = hasPermission('atividades', 'pode_editar');
    const canDelete = hasPermission('atividades', 'pode_excluir');

    const [allActivities, setAllActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    const [funcionarios, setFuncionarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('kanban');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });
    const [allEmpresas, setAllEmpresas] = useState([]);
    const [filters, setFilters] = useState({ empresa: '', empreendimento: '', responsavel: '', status: [], selectedDate: '' });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedActivityForSidebar, setSelectedActivityForSidebar] = useState(null);

    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);

    useEffect(() => {
        try {
            const savedFilters = localStorage.getItem('atividadesFilters');
            if (savedFilters) {
                const parsedFilters = JSON.parse(savedFilters);
                if (!Array.isArray(parsedFilters.status)) {
                    parsedFilters.status = [];
                }
                setFilters(parsedFilters);
            }
        } catch (error) {
            console.error("Falha ao carregar filtros do localStorage", error);
            localStorage.removeItem('atividadesFilters');
        }
    }, []); 

    useEffect(() => {
        try {
            localStorage.setItem('atividadesFilters', JSON.stringify(filters));
        } catch (error) {
            console.error("Falha ao salvar filtros no localStorage", error);
        }
    }, [filters]);

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

    const fetchPageData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: funcData } = await supabase.from('funcionarios').select('id, full_name').order('full_name');
            setFuncionarios(funcData || []);
            const { data: empresasData } = await supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social');
            setAllEmpresas(empresasData || []);
        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        if (canViewPage) {
            setPageTitle('Painel de Atividades');
            fetchPageData();
        }
    }, [setPageTitle, fetchPageData, canViewPage]);

    const fetchAllActivities = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('activities')
            .select('*, empreendimentos(empresa_proprietaria_id), anexos:activity_anexos(*), atividade_pai:atividade_pai_id(id, nome)');
        
        if (error) {
            console.error("Erro ao buscar todas as atividades:", error);
            setAllActivities([]);
        } else {
            setAllActivities(data || []);
        }
        setLoading(false);
    }, [supabase]);

    // =================================================================================
    // AQUI ESTÁ A CORREÇÃO PRINCIPAL
    // O PORQUÊ: A lógica de filtragem anterior era conflitante e não combinava
    // os diferentes filtros de forma correta. Esta nova versão unifica todas as
    // regras de forma clara e sequencial, garantindo que uma atividade só
    // apareça se passar por TODAS as condições de filtro ativas.
    // =================================================================================
    useEffect(() => {
        const activitiesToDisplay = allActivities
            .filter(act => {
                // 1. Filtro principal pelo Empreendimento selecionado no contexto (topo da página)
                if (selectedEmpreendimento !== 'all' && act.empreendimento_id != selectedEmpreendimento) {
                    return false;
                }

                // 2. Filtros da barra de filtros (só são aplicados se "Todos os Empreendimentos" estiver selecionado)
                if (selectedEmpreendimento === 'all') {
                    // Filtro por Empresa
                    if (filters.empresa && (!act.empreendimentos || act.empreendimentos.empresa_proprietaria_id != filters.empresa)) {
                        return false;
                    }
                    // Filtro por Empreendimento específico na barra de filtros
                    if (filters.empreendimento && act.empreendimento_id != filters.empreendimento) {
                        return false;
                    }
                }

                // 3. Filtros gerais que se aplicam sempre
                // Filtro por Responsável
                if (filters.responsavel && act.funcionario_id != filters.responsavel) {
                    return false;
                }

                // Filtro por Status
                if (filters.status.length > 0 && !filters.status.includes(act.status)) {
                    return false;
                }

                // Filtro por Data
                if (filters.selectedDate && !(
                    act.data_inicio_prevista && act.data_fim_prevista &&
                    filters.selectedDate >= act.data_inicio_prevista &&
                    filters.selectedDate <= act.data_fim_prevista
                )) {
                    return false;
                }
                
                // Se a atividade passou por todos os testes, ela será exibida!
                return true;
            })
            .sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });

        setFilteredActivities(activitiesToDisplay);
    }, [selectedEmpreendimento, allActivities, filters, sortConfig]);


    useEffect(() => {
        if (canViewPage && selectedEmpreendimento !== null) {
            fetchAllActivities();
        }
    }, [selectedEmpreendimento, fetchAllActivities, canViewPage]);

    const handleCardClick = (activity) => {
        setSelectedActivityForSidebar(activity);
        setIsSidebarOpen(true);
    };

    const handleEditClick = (activity) => { 
        setEditingActivity(activity); 
        setIsModalOpen(true); 
        setIsSidebarOpen(false);
    };

    const handleDuplicateActivity = (activityToDuplicate) => {
        if (!canCreate) { toast.error("Você não tem permissão para criar atividades."); return; }
        
        toast("Confirmar Duplicação", {
            description: `Deseja criar uma cópia da atividade "${activityToDuplicate.nome}"?`,
            action: {
                label: "Duplicar",
                onClick: () => {
                    const promise = new Promise(async (resolve, reject) => {
                        const { id, created_at, updated_at, empreendimentos, anexos, atividade_pai, ...newActivityData } = activityToDuplicate;
                        
                        newActivityData.nome = `${activityToDuplicate.nome} (Cópia)`;
                        newActivityData.status = 'Não Iniciado';
                        newActivityData.data_inicio_real = null;
                        newActivityData.data_fim_real = null;
                        newActivityData.data_fim_original = null;
                        newActivityData.criado_por_usuario_id = user?.id;
                        
                        const { error } = await supabase.from('activities').insert(newActivityData);
                        
                        if (error) {
                            reject(new Error(error.message));
                        } else {
                            resolve("Atividade duplicada com sucesso!");
                        }
                    });

                    toast.promise(promise, {
                        loading: 'Duplicando atividade...',
                        success: (msg) => { fetchAllActivities(); return msg; },
                        error: (err) => `Erro: ${err.message}`,
                    });
                }
            },
            cancel: { label: "Cancelar" }
        });
    };

    const handleDeleteClick = async (activityId) => {
         toast("Confirmar Exclusão", {
            description: 'Tem certeza que deseja deletar esta atividade?',
            action: {
                label: "Deletar",
                onClick: async () => {
                    const { error } = await supabase.from('activities').delete().eq('id', activityId);
                    if (error) toast.error(`Erro ao deletar: ${error.message}`);
                    else {
                        toast.success('Atividade deletada com sucesso!');
                        fetchAllActivities();
                        setIsSidebarOpen(false);
                    }
                }
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleStatusChange = async (activityId, newStatus) => {
        const activity = allActivities.find(a => a.id === activityId);
        if (!activity) return;
        const updateData = { status: newStatus };
        if (newStatus === 'Em Andamento' && !activity.data_inicio_real) {
            updateData.data_inicio_real = new Date().toISOString().split('T')[0];
        }
        if (newStatus === 'Concluído') {
            updateData.data_fim_real = new Date().toISOString().split('T')[0];
        }
        const { error } = await supabase.from('activities').update(updateData).eq('id', activityId);
        if (error) toast.error(`Erro ao atualizar o status: ${error.message}`);
        else fetchAllActivities();
    };

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

    const handleFilterChange = (filterName, value) => {
        setFilters(prevFilters => ({ ...prevFilters, [filterName]: value }));
    };

    const clearFilters = () => {
        setFilters({ empresa: '', empreendimento: '', responsavel: '', status: [], selectedDate: '' });
        localStorage.removeItem('atividadesFilters');
    };

    const statusOptions = [
        { id: 'Não Iniciado', text: 'Não Iniciado' }, { id: 'Em Andamento', text: 'Em Andamento' },
        { id: 'Concluído', text: 'Concluído' }, { id: 'Pausado', text: 'Pausado' },
        { id: 'Aguardando Material', text: 'Aguardando Material' }, { id: 'Cancelado', text: 'Cancelado' }
    ];

    if (authLoading || loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    }

    if (!canViewPage) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para aceder a esta página.</p>
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

            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-semibold">
                        {selectedEmpreendimentoObj?.nome || 'Todas as Atividades'}
                    </h2>
                    {canCreate && (
                        <button onClick={() => handleEditClick(null)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full md:w-auto mt-2 md:mt-0">+ Nova Atividade</button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 border-t pt-4">
                    {selectedEmpreendimento === 'all' && (
                        <>
                            <select value={filters.empresa || ''} onChange={e => handleFilterChange('empresa', e.target.value)} className="p-2 border rounded-md">
                                <option value="">Filtrar por Empresa...</option>
                                {allEmpresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                            </select>
                            <select value={filters.empreendimento || ''} onChange={e => handleFilterChange('empreendimento', e.target.value)} className="p-2 border rounded-md">
                                <option value="">Filtrar por Empreendimento...</option>
                                {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                        </>
                    )}
                    <select value={filters.responsavel || ''} onChange={e => handleFilterChange('responsavel', e.target.value)} className="p-2 border rounded-md">
                        <option value="">Filtrar por Responsável...</option>
                        {funcionarios.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                    </select>

                    <MultiSelectDropdown
                        options={statusOptions}
                        selectedIds={filters.status} 
                        onChange={(selected) => handleFilterChange('status', selected)}
                        placeholder="Filtrar por Status..."
                    />

                    <input
                        type="date"
                        value={filters.selectedDate || ''}
                        onChange={e => handleFilterChange('selectedDate', e.target.value)}
                        className="p-2 border rounded-md"
                    />

                    <button onClick={clearFilters} className="p-2 bg-gray-200 rounded-md hover:bg-gray-300 w-full">Limpar Filtros</button>
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
                {loading || selectedEmpreendimento === null ? <p className="text-center p-10">Carregando atividades...</p> : (
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
                    onActivityAdded={() => fetchAllActivities()} 
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
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import AtividadeModal from '../../../components/AtividadeModal';
import ActivityList from '../../../components/ActivityList';
import GanttChart from '../../../components/GanttChart';
import KanbanBoard from '../../../components/KanbanBoard';
import ActivityCalendar from '../../../components/ActivityCalendar';
import KpiCard from '../../../components/KpiCard';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faCheckCircle, faTasks, faUserClock, faHistory } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../../../components/financeiro/MultiSelectDropdown';


export default function AtividadesPage() {
    const supabase = createClient();
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    
    const [allActivities, setAllActivities] = useState([]);
    const [filteredActivities, setFilteredActivities] = useState([]);
    
    const [funcionarios, setFuncionarios] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState('kanban');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    
    const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });

    const [allEmpresas, setAllEmpresas] = useState([]);

    // **INÍCIO DA CORREÇÃO DO ERRO #1**
    // Inicializa o estado dos filtros com um valor padrão, sem acessar o localStorage.
    const [filters, setFilters] = useState({
        empresa: '',
        empreendimento: '',
        responsavel: '',
        status: [],
        selectedDate: '' 
    });

    // Usa useEffect para carregar os filtros do localStorage de forma segura, apenas no lado do cliente.
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

    // Salva os filtros no navegador sempre que eles são alterados.
    useEffect(() => {
        try {
            localStorage.setItem('atividadesFilters', JSON.stringify(filters));
        } catch (error) {
            console.error("Falha ao salvar filtros no localStorage", error);
        }
    }, [filters]);
    // **FIM DA CORREÇÃO DO ERRO #1**

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
        setPageTitle('Painel de Atividades');
        fetchPageData();
    }, [setPageTitle, fetchPageData]);

    const fetchAllActivities = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('activities').select('*, empreendimentos(empresa_proprietaria_id)');
        if (error) {
            console.error("Erro ao buscar todas as atividades:", error);
            setAllActivities([]);
        } else {
            setAllActivities(data || []);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        let activitiesToDisplay = [];
        if (selectedEmpreendimento === 'all') {
            activitiesToDisplay = allActivities.filter(act => {
                const empresaMatch = !filters.empresa || (act.empreendimentos && act.empreendimentos.empresa_proprietaria_id == filters.empresa);
                const empreendimentoMatch = !filters.empreendimento || act.empreendimento_id == filters.empreendimento;
                const responsavelMatch = !filters.responsavel || act.funcionario_id == filters.responsavel;
                const statusMatch = filters.status.length === 0 || filters.status.includes(act.status);
                
                const dateMatch = !filters.selectedDate || (
                    act.data_inicio_prevista && act.data_fim_prevista &&
                    filters.selectedDate >= act.data_inicio_prevista &&
                    filters.selectedDate <= act.data_fim_prevista
                );
                
                return empresaMatch && empreendimentoMatch && responsavelMatch && statusMatch && dateMatch;
            });
        } else {
            activitiesToDisplay = allActivities.filter(act => {
                const empreendimentoMatch = act.empreendimento_id == selectedEmpreendimento;
                const statusMatch = filters.status.length === 0 || filters.status.includes(act.status);
                const dateMatch = !filters.selectedDate || (
                    act.data_inicio_prevista && act.data_fim_prevista &&
                    filters.selectedDate >= act.data_inicio_prevista &&
                    filters.selectedDate <= act.data_fim_prevista
                );
                return empreendimentoMatch && statusMatch && dateMatch;
            });
        }

        activitiesToDisplay.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        setFilteredActivities(activitiesToDisplay);
    }, [selectedEmpreendimento, allActivities, filters, sortConfig]);


    useEffect(() => {
        if (selectedEmpreendimento !== null) {
            fetchAllActivities();
        }
    }, [selectedEmpreendimento, fetchAllActivities]);

    const handleEditClick = (activity) => { setEditingActivity(activity); setIsModalOpen(true); };
    const handleDeleteClick = async (activityId) => {
        if (window.confirm('Tem certeza que deseja deletar esta atividade?')) {
            const { error } = await supabase.from('activities').delete().eq('id', activityId);
            if (error) alert(`Erro ao deletar: ${error.message}`);
            else {
                alert('Atividade deletada com sucesso!');
                fetchAllActivities();
            }
        }
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
        if (error) alert(`Erro ao atualizar o status: ${error.message}`);
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
        setFilters(prevFilters => ({
            ...prevFilters,
            [filterName]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            empresa: '',
            empreendimento: '',
            responsavel: '',
            status: [],
            selectedDate: ''
        });
        localStorage.removeItem('atividadesFilters');
    };

    const statusOptions = [
        { id: 'Não Iniciado', text: 'Não Iniciado' },
        { id: 'Em Andamento', text: 'Em Andamento' },
        { id: 'Concluído', text: 'Concluído' },
        { id: 'Pausado', text: 'Pausado' },
        { id: 'Aguardando Material', text: 'Aguardando Material' },
        { id: 'Cancelado', text: 'Cancelado' }
    ];


    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-semibold">
                        {selectedEmpreendimentoObj?.nome || 'Todas as Atividades'}
                    </h2>
                    <button onClick={() => handleEditClick(null)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full md:w-auto mt-2 md:mt-0">+ Nova Atividade</button>
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
                        {activeTab === 'kanban' && <KanbanBoard activities={filteredActivities} onEditActivity={handleEditClick} onStatusChange={handleStatusChange} />}
                        {activeTab === 'list' && <ActivityList activities={filteredActivities} requestSort={requestSort} sortConfig={sortConfig} onEditClick={handleEditClick} onDeleteClick={handleDeleteClick} onStatusChange={handleStatusChange} />}
                        {activeTab === 'gantt' && <GanttChart activities={filteredActivities} onEditActivity={handleEditClick} />}
                        {activeTab === 'calendar' && <ActivityCalendar activities={filteredActivities} onActivityClick={handleEditClick} />}
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
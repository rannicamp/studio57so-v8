"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { createUser, toggleUserStatus, resetUserPassword } from '@/app/(main)/configuracoes/usuarios/actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faTimes, faSpinner, faSearch, faFilter, 
    faUserShield, faKey, faSort, faSortUp, faSortDown, 
    faCalendarAlt, faUsers, faUserCheck, faUserSlash 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

// --- Função Helper para Persistência de UI ---
const UI_STATE_KEY = 'STUDIO57_USERS_UI_STATE';

const usePersistentUiState = (initialState) => {
    const [state, setState] = useState(initialState);
    const isFirstRender = useRef(true);

    useEffect(() => {
        const cached = localStorage.getItem(UI_STATE_KEY);
        if (cached) {
            try {
                setState(prev => ({ ...prev, ...JSON.parse(cached) }));
            } catch (e) {
                console.error("Erro ao restaurar estado da UI", e);
            }
        }
        isFirstRender.current = false;
    }, []);

    useEffect(() => {
        if (!isFirstRender.current) {
            localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
        }
    }, [state]);

    return [state, setState];
};

// --- Função fetchUsers (Client Side) ---
const fetchUsers = async (organizationId) => {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('usuarios')
        .select(`
            id, nome, sobrenome, email, is_active, created_at, avatar_url,
            funcao:funcoes ( id, nome_funcao ),
            funcionario:funcionarios ( id, full_name, cpf )
        `)
        .eq('organizacao_id', organizationId)
        .order('nome', { ascending: true });

    if (error) throw new Error('Não foi possível buscar os usuários.');
    return data;
};

// --- Sub-componentes ---
const UserAvatar = ({ nome, sobrenome, url }) => {
    if (url) {
        return <img src={url} alt={nome} className="w-10 h-10 rounded-full object-cover shadow-sm" />;
    }
    const initials = `${nome?.charAt(0) || ''}${sobrenome?.charAt(0) || ''}`.toUpperCase();
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500'];
    const colorIndex = (nome?.length + sobrenome?.length) % colors.length;
    
    return (
        <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
            {initials}
        </div>
    );
};

const StatCard = ({ title, value, icon, colorClass, bgColorClass }) => (
    <div className={`flex items-center p-4 rounded-lg border ${bgColorClass} ${colorClass.replace('text-', 'border-').replace('500', '200')}`}>
        <div className={`p-3 rounded-full ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} mr-4`}>
            <FontAwesomeIcon icon={icon} className={`text-xl ${colorClass}`} />
        </div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
        </div>
    </div>
);

// --- Modal de Novo Usuário (Simplificado para o exemplo, mas funcional) ---
const AddUserModal = ({ isOpen, onClose, allRoles, allEmployees, organizationId }) => {
    const queryClient = useQueryClient();
    const formRef = useRef(null);

    const { mutate, isPending } = useMutation({
        mutationFn: async (formData) => {
            const result = await createUser(null, formData);
            if (!result.success) throw new Error(result.message);
            return result;
        },
        onSuccess: () => {
            toast.success('Usuário criado com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['users', organizationId] });
            onClose();
            if (formRef.current) formRef.current.reset();
        },
        onError: (error) => toast.error(error.message),
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Novo Usuário</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                <form ref={formRef} action={mutate} className="space-y-4">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                            <input type="text" name="nome" required className="input-std" placeholder="Nome" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sobrenome</label>
                            <input type="text" name="sobrenome" required className="input-std" placeholder="Sobrenome" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input type="email" name="email" required className="input-std" placeholder="email@exemplo.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                        <input type="password" name="password" required className="input-std" placeholder="******" minLength={6} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Função</label>
                            <select name="funcao_id" required className="input-std">
                                <option value="">Selecione...</option>
                                {allRoles.map(r => <option key={r.id} value={r.id}>{r.nome_funcao}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular RH</label>
                            <select name="funcionario_id" className="input-std">
                                <option value="">Nenhum</option>
                                {allEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2">
                            {isPending && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />} Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Modal de Senha ---
const ResetPasswordModal = ({ isOpen, onClose, user }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const result = await resetUserPassword(user.id, password);
        setIsLoading(false);
        if (result.success) { toast.success(result.message); onClose(); setPassword(''); } 
        else { toast.error(result.message); }
    };

    if (!isOpen || !user) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Nova Senha para {user.nome}</h3>
                <form onSubmit={handleReset} className="space-y-4">
                    <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha..." className="input-std" required minLength={6} />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="btn-primary bg-yellow-500 hover:bg-yellow-600 border-yellow-500">{isLoading ? '...' : 'Alterar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Componente Principal ---
export default function UserManagementForm({ initialUsers, allEmployees, allRoles, organizationId }) {
    const queryClient = useQueryClient();
    const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
    const [passwordModalUser, setPasswordModalUser] = useState(null);
    
    // Estado de UI com ordenação
    const [uiState, setUiState] = usePersistentUiState({
        search: '',
        filterRole: 'all',
        filterStatus: 'all',
        sortKey: 'created_at', // Padrão: data de cadastro
        sortDirection: 'desc'  // Padrão: mais recentes primeiro
    });

    const { data: users } = useQuery({
        queryKey: ['users', organizationId],
        queryFn: () => fetchUsers(organizationId),
        initialData: initialUsers,
        refetchOnWindowFocus: true,
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ userId, currentStatus }) => toggleUserStatus(userId, currentStatus),
        onSuccess: (data) => {
            if (data.success) { toast.success(data.message); queryClient.invalidateQueries({ queryKey: ['users', organizationId] }); }
            else { toast.error(data.message); }
        }
    });

    // --- KPIs Calculados ---
    const stats = useMemo(() => {
        if (!users) return { total: 0, active: 0, inactive: 0 };
        const total = users.length;
        const active = users.filter(u => u.is_active).length;
        return { total, active, inactive: total - active };
    }, [users]);

    // --- Lógica de Filtragem e Ordenação ---
    const processedUsers = useMemo(() => {
        if (!users) return [];
        
        // 1. Filtrar
        let result = users.filter(user => {
            const searchLower = uiState.search.toLowerCase();
            const matchesSearch = 
                user.nome?.toLowerCase().includes(searchLower) ||
                user.sobrenome?.toLowerCase().includes(searchLower) ||
                user.email?.toLowerCase().includes(searchLower);
            
            const matchesRole = uiState.filterRole === 'all' || user.funcao?.id.toString() === uiState.filterRole;
            
            const matchesStatus = 
                uiState.filterStatus === 'all' ? true :
                uiState.filterStatus === 'active' ? user.is_active :
                !user.is_active;

            return matchesSearch && matchesRole && matchesStatus;
        });

        // 2. Ordenar
        result.sort((a, b) => {
            let valA, valB;

            // Selecionar o valor baseado na chave
            switch (uiState.sortKey) {
                case 'nome':
                    valA = `${a.nome} ${a.sobrenome}`.toLowerCase();
                    valB = `${b.nome} ${b.sobrenome}`.toLowerCase();
                    break;
                case 'funcao':
                    valA = a.funcao?.nome_funcao?.toLowerCase() || '';
                    valB = b.funcao?.nome_funcao?.toLowerCase() || '';
                    break;
                case 'created_at':
                    valA = new Date(a.created_at || 0).getTime();
                    valB = new Date(b.created_at || 0).getTime();
                    break;
                case 'status':
                    valA = a.is_active ? 1 : 0;
                    valB = b.is_active ? 1 : 0;
                    break;
                default:
                    valA = a[uiState.sortKey];
                    valB = b[uiState.sortKey];
            }

            if (valA < valB) return uiState.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return uiState.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [users, uiState]);

    // Handler de Ordenação
    const handleSort = (key) => {
        setUiState(prev => ({
            ...prev,
            sortKey: key,
            sortDirection: prev.sortKey === key && prev.sortDirection === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Componente de Cabeçalho Sortável
    const SortHeader = ({ label, sortKey, align = 'left' }) => (
        <th 
            className={`px-6 py-3 text-${align} text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none group`}
            onClick={() => handleSort(sortKey)}
        >
            <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                <span className={`text-gray-400 ${uiState.sortKey === sortKey ? 'text-blue-500' : 'opacity-0 group-hover:opacity-50'}`}>
                    <FontAwesomeIcon icon={uiState.sortKey === sortKey ? (uiState.sortDirection === 'asc' ? faSortUp : faSortDown) : faSort} />
                </span>
            </div>
        </th>
    );

    return (
        <div className="p-0">
            <style jsx global>{`
                .input-std { @apply w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all; }
                .btn-primary { @apply px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all; }
                .btn-secondary { @apply px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors; }
            `}</style>

            <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setAddUserModalOpen(false)} allRoles={allRoles} allEmployees={allEmployees} organizationId={organizationId} />
            <ResetPasswordModal isOpen={!!passwordModalUser} onClose={() => setPasswordModalUser(null)} user={passwordModalUser} />

            {/* --- SEÇÃO DE KPIs --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                <StatCard title="Total de Usuários" value={stats.total} icon={faUsers} colorClass="text-blue-600" bgColorClass="bg-white dark:bg-gray-800" />
                <StatCard title="Usuários Ativos" value={stats.active} icon={faUserCheck} colorClass="text-green-600" bgColorClass="bg-white dark:bg-gray-800" />
                <StatCard title="Usuários Inativos" value={stats.inactive} icon={faUserSlash} colorClass="text-red-500" bgColorClass="bg-white dark:bg-gray-800" />
            </div>

            {/* --- BARRA DE FERRAMENTAS --- */}
            <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800">
                {/* Busca */}
                <div className="relative w-full xl:w-96 group">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou email..." 
                        value={uiState.search}
                        onChange={(e) => setUiState(prev => ({ ...prev, search: e.target.value }))}
                        className="input-std pl-10"
                    />
                </div>

                {/* Filtros e Ações */}
                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-center">
                    {/* Filtro Função */}
                    <div className="relative w-full sm:w-auto">
                        <select 
                            value={uiState.filterRole}
                            onChange={(e) => setUiState(prev => ({ ...prev, filterRole: e.target.value }))}
                            className="appearance-none pl-3 pr-8 py-2 w-full sm:w-48 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="all">Todas as Funções</option>
                            {allRoles.map(role => (
                                <option key={role.id} value={role.id}>{role.nome_funcao}</option>
                            ))}
                        </select>
                        <FontAwesomeIcon icon={faFilter} className="absolute right-3 top-3 text-gray-400 text-xs pointer-events-none" />
                    </div>

                    {/* Filtro Status */}
                    <div className="relative w-full sm:w-auto">
                        <select 
                            value={uiState.filterStatus}
                            onChange={(e) => setUiState(prev => ({ ...prev, filterStatus: e.target.value }))}
                            className="appearance-none pl-3 pr-8 py-2 w-full sm:w-40 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="all">Todos Status</option>
                            <option value="active">Ativos</option>
                            <option value="inactive">Bloqueados</option>
                        </select>
                        <FontAwesomeIcon icon={faFilter} className="absolute right-3 top-3 text-gray-400 text-xs pointer-events-none" />
                    </div>

                    <button onClick={() => setAddUserModalOpen(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center">
                        <FontAwesomeIcon icon={faPlus} /> Novo Usuário
                    </button>
                </div>
            </div>

            {/* --- TABELA --- */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                            <SortHeader label="Usuário" sortKey="nome" />
                            <SortHeader label="Função" sortKey="funcao" />
                            <SortHeader label="Data Cadastro" sortKey="created_at" />
                            <SortHeader label="Status" sortKey="status" />
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                        {processedUsers.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                    Nenhum usuário encontrado.
                                </td>
                            </tr>
                        ) : (
                            processedUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                                    {/* Nome e Avatar */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <UserAvatar nome={user.nome} sobrenome={user.sobrenome} url={user.avatar_url} />
                                            <div className="ml-4">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {user.nome} {user.sobrenome}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Função */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border 
                                            ${['Administrador', 'Proprietário'].includes(user.funcao?.nome_funcao)
                                                ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300' 
                                                : user.funcao?.nome_funcao === 'Corretor'
                                                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300'
                                                    : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                            {user.funcao?.nome_funcao || 'Sem Função'}
                                        </span>
                                        {user.funcionario && (
                                            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <FontAwesomeIcon icon={faUserShield} className="w-3" />
                                                {user.funcionario.full_name.split(' ')[0]}
                                            </div>
                                        )}
                                    </td>

                                    {/* Data de Cadastro */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-300" />
                                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>

                                    {/* Status Switch */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button 
                                            onClick={() => toggleStatusMutation.mutate({ userId: user.id, currentStatus: user.is_active })}
                                            disabled={toggleStatusMutation.isPending}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                                ${user.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <span className={`${user.is_active ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                        </button>
                                        <span className="ml-2 text-sm text-gray-500">
                                            {user.is_active ? 'Ativo' : 'Bloqueado'}
                                        </span>
                                    </td>

                                    {/* Ações */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => setPasswordModalUser(user)}
                                            className="text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 mx-2 p-2 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all tooltip"
                                            title="Redefinir Senha"
                                        >
                                            <FontAwesomeIcon icon={faKey} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                <span>Exibindo {processedUsers.length} registros</span>
                <span>Última atualização: {new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    );
}
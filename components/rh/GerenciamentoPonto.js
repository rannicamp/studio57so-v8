// components/rh/GerenciamentoPonto.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

// Componentes Filhos
import FolhaPonto from './FolhaPonto';
import PontoImporter from './PontoImporter';

// Ícones
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner,
    faTimes,
    faSearch,
    faCalendarAlt,
    faUserClock
} from '@fortawesome/free-solid-svg-icons';

// Modal de Importação (Estilizado)
const ImporterModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:rounded-xl shadow-2xl md:w-full md:max-w-4xl flex flex-col border border-gray-100 overflow-hidden">
                <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">Importar Registros de Ponto</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-white">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>
                <div className="p-0 md:p-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Função de Busca (Memoizada pelo TanStack Query)
const fetchAllEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name, numero_ponto, status')
        .eq('organizacao_id', organizacao_id)
        .order('full_name');

    if (error) throw new Error('Não foi possível carregar a lista de funcionários.');
    return data || [];
};

export default function GerenciamentoPonto({ searchTerm = '', isImporterOpen, onCloseImporter }) {
    const { hasPermission, organizacao_id } = useAuth();
    const canCreate = hasPermission('ponto', 'pode_criar');
    const canEdit = hasPermission('ponto', 'pode_editar');

    // --- LÓGICA DE PERSISTÊNCIA DO MODAL (A Mágica da Recuperação) ---
    // Criamos um estado local para controlar o modal independentemente do Pai
    const [localModalOpen, setLocalModalOpen] = useState(isImporterOpen);

    // 1. Sincroniza com o Pai (Se o Pai mandar abrir, a gente abre)
    useEffect(() => {
        setLocalModalOpen(isImporterOpen);
    }, [isImporterOpen]);

    // 2. Recuperação de Crash (Se o LocalStorage mandar abrir, a gente abre mesmo se o Pai disser não)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const shouldRecover = localStorage.getItem('pontoImporterOpen');
            // Se tiver a flag 'true' E o modal estiver fechado, força a abertura
            if (shouldRecover === 'true') {
                console.log("🔄 Recuperando sessão de importação...");
                setLocalModalOpen(true);
            }
        }
    }, []);

    // Função interna para fechar, garantindo que tudo fique sincronizado
    const handleCloseModal = () => {
        setLocalModalOpen(false);
        // Remove a flag de segurança para não reabrir sozinho depois
        if (typeof window !== 'undefined') localStorage.removeItem('pontoImporterOpen');
        onCloseImporter(); // Avisa o Pai
    };

    // --- FIM DA LÓGICA DE RECUPERAÇÃO ---


    // Busca de dados eficiente
    const { data: employees = [], isLoading, error, refetch: refetchEmployees } = useQuery({
        queryKey: ['employeesPonto', organizacao_id],
        queryFn: () => fetchAllEmployees(organizacao_id),
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });

    // Estados Locais
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');

    // Filtro Inteligente (Filtragem local super rápida)
    const filteredEmployeesList = useMemo(() => {
        if (!searchTerm) return employees;
        const lowerTerm = searchTerm.toLowerCase();
        return employees.filter(e =>
            e.full_name.toLowerCase().includes(lowerTerm) ||
            String(e.numero_ponto || '').includes(lowerTerm)
        );
    }, [employees, searchTerm]);

    const activeEmployees = filteredEmployeesList.filter(emp => emp.status !== 'Demitido');
    const dismissedEmployees = filteredEmployeesList.filter(emp => emp.status === 'Demitido');

    // Inicialização (Mês Atual e Recuperação de Seleção)
    useEffect(() => {
        const today = new Date();
        setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }, []);

    useEffect(() => {
        if (!isLoading && employees.length > 0) {
            const preSelectedId = localStorage.getItem('selectedEmployeeIdForPonto');
            // Só restaura se o funcionário ainda existir na lista (segurança)
            if (preSelectedId && employees.some(emp => emp.id.toString() === preSelectedId)) {
                setSelectedEmployeeId(preSelectedId);
            }
        }
    }, [isLoading, employees]);

    const handleEmployeeChange = (employeeId) => {
        setSelectedEmployeeId(employeeId);
        // Persistência leve da seleção
        if (employeeId) localStorage.setItem('selectedEmployeeIdForPonto', employeeId);
        else localStorage.removeItem('selectedEmployeeIdForPonto');
    };

    const handleSuccessfulImport = () => {
        handleCloseModal(); // Fecha usando nossa função inteligente
        refetchEmployees(); // Atualiza lista caso a importação crie vínculos
        toast.success("Importação concluída com sucesso!");

        // Pequeno hack visual para forçar atualização se necessário
        const currentId = selectedEmployeeId;
        if (currentId) {
            setSelectedEmployeeId('');
            setTimeout(() => setSelectedEmployeeId(currentId), 50);
        }
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
            <p>Carregando dados do ponto...</p>
        </div>
    );

    if (error) return (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-center">
            <p>Erro: {error.message}</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Modal de Importação - Agora controlado por localModalOpen */}
            <ImporterModal isOpen={localModalOpen} onClose={handleCloseModal}>
                <PontoImporter employees={employees} onImport={handleSuccessfulImport} />
            </ImporterModal>

            {/* Barra de Seleção */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">

                    {/* Select Funcionário */}
                    <div>
                        <label htmlFor="employee-select" className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUserClock} className="text-blue-500" />
                            Selecione o Funcionário
                            {searchTerm && <span className="text-xs text-blue-500 font-normal bg-blue-50 px-2 py-0.5 rounded-full">(Filtro: "{searchTerm}")</span>}
                        </label>
                        <div className="relative">
                            <select
                                id="employee-select"
                                value={selectedEmployeeId}
                                onChange={(e) => handleEmployeeChange(e.target.value)}
                                className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm transition-all"
                            >
                                <option value="">-- Escolha um colaborador --</option>

                                {activeEmployees.length > 0 && (
                                    <optgroup label="Ativos">
                                        {activeEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                        ))}
                                    </optgroup>
                                )}

                                {dismissedEmployees.length > 0 && (
                                    <optgroup label="Desligados">
                                        {dismissedEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        {activeEmployees.length === 0 && dismissedEmployees.length === 0 && searchTerm && (
                            <p className="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded">
                                Nenhum funcionário encontrado com esse filtro.
                            </p>
                        )}
                    </div>

                    {/* Select Mês */}
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-500" />
                            Mês de Referência
                        </label>
                        <input
                            type="month"
                            id="month-select"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="block w-full py-2.5 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Conteúdo Principal */}
            {selectedEmployeeId && selectedMonth ? (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <FolhaPonto
                        key={`${selectedEmployeeId}-${selectedMonth}`}
                        employeeId={selectedEmployeeId}
                        month={selectedMonth}
                        canEdit={canEdit || canCreate}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center min-h-[300px] transition-all hover:bg-gray-100/50 hover:border-gray-300">
                    <div className="bg-white p-5 rounded-full shadow-sm mb-4">
                        <FontAwesomeIcon icon={faSearch} className="text-gray-300 text-3xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700">Nenhum espelho de ponto visível</h3>
                    <p className="text-gray-500 mt-1 max-w-sm">
                        Selecione um <strong>funcionário</strong> e o <strong>mês de referência</strong> acima para visualizar, editar ou fechar a folha de ponto.
                    </p>
                </div>
            )}
        </div>
    );
}
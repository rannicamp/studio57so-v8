"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import PontoImporter from '../../../components/PontoImporter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock, faFileImport, faTimes, faPrint } from '@fortawesome/free-solid-svg-icons';
import RelatorioPonto from '../../../components/RelatorioPonto'; // Importando nosso novo componente

// Modal de Importação (semelhante ao anterior)
const ImporterModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Importar Registros de Ponto</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <FontAwesomeIcon icon={faTimes} size="lg"/>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};


export default function PontoPage() {
    const supabase = createClient();
    const router = useRouter();
    const { hasPermission, loading: authLoading } = useAuth();

    const canViewPage = hasPermission('ponto', 'pode_ver');
    const canCreate = hasPermission('ponto', 'pode_criar');
    const canEdit = hasPermission('ponto', 'pode_editar');

    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    
    const [selectedMonth, setSelectedMonth] = useState('');
     useEffect(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${currentYear}-${currentMonth}`);
    }, []);

    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);

    const fetchEmployees = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('funcionarios')
            .select('id, full_name, numero_ponto')
            .order('full_name');

        if (error) {
            setError('Não foi possível carregar a lista de funcionários.');
        } else {
            setEmployees(data || []);
        }
        setIsLoading(false);
    }, [supabase]);
    
    const fetchSelectedEmployeeData = useCallback(async (employeeId, month) => {
        if (!employeeId || !month) {
            setSelectedEmployee(null);
            return;
        }
        setIsLoading(true);
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

        const { data: employeeData, error: empError } = await supabase
            .from('funcionarios')
            .select('*, jornada:jornadas(*, detalhes:jornada_detalhes(*))')
            .eq('id', employeeId)
            .single();
            
        if (empError) {
             setError('Erro ao buscar dados do funcionário.');
             setIsLoading(false);
             return;
        }

        const { data: pontosData } = await supabase.from('pontos').select('*').eq('funcionario_id', employeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        const { data: abonosData } = await supabase.from('abonos').select('*').eq('funcionario_id', employeeId).gte('data_abono', startDate).lte('data_abono', endDate);
        
        setSelectedEmployee({
            ...employeeData,
            pontosDoMes: pontosData || [],
            abonosDoMes: abonosData || [],
        });
        
        setIsLoading(false);

    }, [supabase]);

    useEffect(() => {
        if (canViewPage) {
            fetchEmployees();
        } else {
            setIsLoading(false);
        }
    }, [fetchEmployees, canViewPage]);

    const handleEmployeeChange = (employeeId) => {
        fetchSelectedEmployeeData(employeeId, selectedMonth);
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        if (selectedEmployee) {
            fetchSelectedEmployeeData(selectedEmployee.id, month);
        }
    };
    
    const handleSuccessfulImport = () => {
        setIsImporterOpen(false);
        if(selectedEmployee) {
            fetchSelectedEmployeeData(selectedEmployee.id, selectedMonth);
        }
    };

    if (authLoading) {
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
    if (error) {
        return <p className="text-center mt-10 text-red-500">{error}</p>;
    }

    return (
        <div className="space-y-6">
            <ImporterModal isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)}>
                <PontoImporter 
                    employees={employees}
                    onImport={handleSuccessfulImport} 
                />
            </ImporterModal>

            <div className="flex justify-between items-center no-print">
                <h1 className="text-3xl font-bold text-gray-900">Controle de Ponto</h1>
                {canCreate && (
                    <button onClick={() => setIsImporterOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileImport} />
                        Importar Registros
                    </button>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700">Funcionário</label>
                        <select id="employee-select" onChange={(e) => handleEmployeeChange(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                            <option value="">-- Selecione um funcionário --</option>
                            {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mês/Ano</label>
                        <input type="month" id="month-select" value={selectedMonth} onChange={(e) => handleMonthChange(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                </div>
            </div>
            
            {isLoading && selectedEmployee && (
                 <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando relatório...</div>
            )}
            
            {!isLoading && selectedEmployee && (
                <RelatorioPonto 
                    key={selectedEmployee.id + selectedMonth}
                    employee={selectedEmployee}
                    pontosDoMes={selectedEmployee.pontosDoMes}
                    abonosDoMes={selectedEmployee.abonosDoMes}
                    selectedMonth={selectedMonth}
                    canEdit={canEdit || canCreate}
                    onDataChange={() => fetchSelectedEmployeeData(selectedEmployee.id, selectedMonth)}
                />
            )}
            
            {!selectedEmployee && !isLoading && (
                 <div className="text-center p-10 bg-gray-50 rounded-lg no-print">
                    <p className="text-gray-600">Selecione um funcionário para visualizar a folha de ponto.</p>
                 </div>
            )}
        </div>
    );
}
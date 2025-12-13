// components/rh/GerenciamentoPonto.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FolhaPonto from '../FolhaPonto';
import PontoImporter from '../PontoImporter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faCheckCircle, faExclamationCircle, faInfoCircle, faSearch } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';

const ToastComponent = ({ message, type, onclose }) => {
    useEffect(() => { const timer = setTimeout(onclose, 4000); return () => clearTimeout(timer); }, [onclose]);
    const styles = { success: { bg: 'bg-green-500', icon: faCheckCircle }, error: { bg: 'bg-red-500', icon: faExclamationCircle }, info: { bg: 'bg-blue-500', icon: faInfoCircle } };
    const currentStyle = styles[type] || styles.info;
    return ( <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50 no-print`}> <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" /> <span>{message}</span> </div> );
};

const ImporterModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">Importar Registros de Ponto</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><FontAwesomeIcon icon={faTimes} size="lg"/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
            </div>
        </div>
    );
};

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

// Recebendo searchTerm e controles do Modal do Pai
export default function GerenciamentoPonto({ searchTerm = '', isImporterOpen, onCloseImporter }) {
    const { hasPermission, organizacao_id } = useAuth();
    const canCreate = hasPermission('ponto', 'pode_criar');
    const canEdit = hasPermission('ponto', 'pode_editar');
    
    const { data: employees = [], isLoading, error, refetch: refetchEmployees } = useQuery({ 
        queryKey: ['employeesPonto', organizacao_id], 
        queryFn: () => fetchAllEmployees(organizacao_id),
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5, 
    });

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    
    // Removemos o estado local isImporterOpen pois agora vem via props
    
    const [internalToast, setInternalToast] = useState({ show: false, message: '', type: 'info' });
    
    // LÓGICA DE FILTRO INTELIGENTE
    const filteredEmployeesList = useMemo(() => {
        if (!searchTerm) return employees;
        return employees.filter(e => e.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [employees, searchTerm]);

    const activeEmployees = filteredEmployeesList.filter(emp => emp.status !== 'Demitido');
    const dismissedEmployees = filteredEmployeesList.filter(emp => emp.status === 'Demitido');

    useEffect(() => {
        const today = new Date();
        setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }, []);

    useEffect(() => {
        if (!isLoading && employees.length > 0) {
            const preSelectedId = localStorage.getItem('selectedEmployeeIdForPonto');
            if (preSelectedId && employees.some(emp => emp.id.toString() === preSelectedId)) {
                setSelectedEmployeeId(preSelectedId);
            }
        }
    }, [isLoading, employees]);

    const handleEmployeeChange = (employeeId) => {
        setSelectedEmployeeId(employeeId);
        if (employeeId) localStorage.setItem('selectedEmployeeIdForPonto', employeeId);
        else localStorage.removeItem('selectedEmployeeIdForPonto');
    };

    const handleSuccessfulImport = () => {
        onCloseImporter(); // Fecha usando a função do pai
        refetchEmployees();
        const currentId = selectedEmployeeId;
        if(currentId) {
            setSelectedEmployeeId('');
            setTimeout(() => setSelectedEmployeeId(currentId), 100);
        }
        setInternalToast({ show: true, message: "Importação concluída com sucesso!", type: "success" });
    };
    
    if (isLoading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" /></div>;
    if (error) return <p className="text-center mt-10 text-red-500 bg-red-50 p-4 rounded">{error.message}</p>;

    return (
        <div className="space-y-6">
            {internalToast.show && <ToastComponent message={internalToast.message} type={internalToast.type} onclose={() => setInternalToast({ ...internalToast, show: false })} />}
            
            {/* Modal controlado pelo Pai */}
            <ImporterModal isOpen={isImporterOpen} onClose={onCloseImporter}>
                <PontoImporter employees={employees} onImport={handleSuccessfulImport} />
            </ImporterModal>

            {/* Removemos a Barra de Ação Local antiga aqui */}
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700 mb-1">
                            Selecione o Funcionário
                            {searchTerm && <span className="text-xs text-blue-500 font-normal ml-2">(Filtrado por: "{searchTerm}")</span>}
                        </label>
                        <select 
                            id="employee-select" 
                            value={selectedEmployeeId} 
                            onChange={(e) => handleEmployeeChange(e.target.value)} 
                            className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="">-- Escolha na lista --</option>
                            
                            {activeEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                            
                            {dismissedEmployees.length > 0 && (
                                <optgroup label="--- Demitidos ---">
                                    {dismissedEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        {activeEmployees.length === 0 && dismissedEmployees.length === 0 && searchTerm && (
                            <p className="text-xs text-red-400 mt-1">Nenhum funcionário encontrado com esse nome.</p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência</label>
                        <input 
                            type="month" 
                            id="month-select" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)} 
                            className="mt-1 block w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm" 
                        />
                    </div>
                </div>
            </div>
            
            {selectedEmployeeId && selectedMonth ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <FolhaPonto key={`${selectedEmployeeId}-${selectedMonth}`} employeeId={selectedEmployeeId} month={selectedMonth} canEdit={canEdit || canCreate} />
                </div>
            ) : (
                 <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 no-print flex flex-col items-center">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <FontAwesomeIcon icon={faSearch} className="text-gray-300 text-2xl" />
                    </div>
                    <p className="text-gray-500 font-medium">Selecione um funcionário e o mês acima</p>
                    <p className="text-xs text-gray-400 mt-1">Os dados do ponto aparecerão aqui.</p>
                 </div>
            )}
        </div>
    );
}
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FolhaPonto from '../FolhaPonto';
import PontoImporter from '../PontoImporter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileImport, faTimes, faCheckCircle, faExclamationCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';

// O Toast customizado pode ser mantido, sem alterações.
const Toast = ({ message, type, onclose }) => {
    useEffect(() => { const timer = setTimeout(onclose, 4000); return () => clearTimeout(timer); }, [onclose]);
    const styles = { success: { bg: 'bg-green-500', icon: faCheckCircle }, error: { bg: 'bg-red-500', icon: faExclamationCircle }, info: { bg: 'bg-blue-500', icon: faInfoCircle } };
    const currentStyle = styles[type] || styles.info;
    return ( <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50 no-print`}> <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" /> <span>{message}</span> </div> );
};

const ImporterModal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Importar Registros de Ponto</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} size="lg"/></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

// O PORQUÊ: A função de busca agora é isolada e segura, recebendo a organizacao_id.
const fetchAllEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    // BLINDADO: Adicionado o filtro .eq('organizacao_id', organizacao_id)
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name, numero_ponto')
        .eq('organizacao_id', organizacao_id) // <-- Filtro de segurança
        .order('full_name');
        
    if (error) throw new Error('Não foi possível carregar a lista de funcionários.');
    return data || [];
};

export default function GerenciamentoPonto() {
    const { hasPermission, organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização
    const canCreate = hasPermission('ponto', 'pode_criar');
    const canEdit = hasPermission('ponto', 'pode_editar');
    
    // PADRÃO OURO: Refinamos o useQuery para depender da organizacao_id.
    const { data: employees = [], isLoading, error, refetch: refetchEmployees } = useQuery({ 
        queryKey: ['employeesPonto', organizacao_id], 
        queryFn: () => fetchAllEmployees(organizacao_id),
        enabled: !!organizacao_id, // A query só é executada se a organização existir.
    });

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const showToast = (message, type = 'info') => setToast({ show: true, message, type });

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
        setIsImporterOpen(false);
        refetchEmployees();
        const currentId = selectedEmployeeId;
        setSelectedEmployeeId('');
        setTimeout(() => setSelectedEmployeeId(currentId), 100);
    };
    
    if (isLoading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (error) return <p className="text-center mt-10 text-red-500">{error.message}</p>;

    return (
        <div className="space-y-6">
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}
            <ImporterModal isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)}>
                <PontoImporter employees={employees} onImport={handleSuccessfulImport} showToast={showToast} />
            </ImporterModal>
            <div className="flex justify-between items-center no-print">
                <p className="text-gray-600">Visualize e edite a folha de ponto dos funcionários.</p>
                {canCreate && (
                    <button onClick={() => setIsImporterOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileImport} /> Importar
                    </button>
                )}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label htmlFor="employee-select" className="block text-sm font-medium text-gray-700">Funcionário</label>
                        <select id="employee-select" value={selectedEmployeeId} onChange={(e) => handleEmployeeChange(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                            <option value="">-- Selecione um funcionário --</option>
                            {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mês/Ano</label>
                        <input type="month" id="month-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                </div>
            </div>
            {selectedEmployeeId && selectedMonth ? (
                <FolhaPonto key={`${selectedEmployeeId}-${selectedMonth}`} employeeId={selectedEmployeeId} month={selectedMonth} canEdit={canEdit || canCreate} />
            ) : (
                 <div className="text-center p-10 bg-gray-50 rounded-lg no-print">
                    <p className="text-gray-600">Selecione um funcionário e um mês para visualizar a folha de ponto.</p>
                 </div>
            )}
        </div>
    );
}
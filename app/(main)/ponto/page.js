"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import FolhaPonto from '../../../components/FolhaPonto';
import PontoImporter from '../../../components/PontoImporter'; // Novo componente de importação

// Componente de Notificação (Toast)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const Toast = ({ message, type, onclose }) => {
  useEffect(() => {
    const timer = setTimeout(onclose, 4000);
    return () => clearTimeout(timer);
  }, [onclose]);

  const styles = {
    success: { bg: 'bg-green-500', icon: faCheckCircle },
    error: { bg: 'bg-red-500', icon: faExclamationCircle },
    info: { bg: 'bg-blue-500', icon: faInfoCircle },
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50`}>
      <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" />
      <span>{message}</span>
    </div>
  );
};


export default function PontoPage() {
    const supabase = createClient();
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('importar'); // 'importar' ou 'folha'
    const [folhaPontoKey, setFolhaPontoKey] = useState(Date.now()); // Chave para forçar a remontagem
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

    const showToast = (message, type = 'info') => {
      setToast({ show: true, message, type });
    };

    // Busca os funcionários
    const fetchEmployees = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('funcionarios')
            .select('id, full_name, numero_ponto') // Inclui o numero_ponto para a importação
            .order('full_name');

        if (error) {
            console.error('Erro ao buscar funcionários:', error);
            setError('Não foi possível carregar a lista de funcionários.');
        } else {
            setEmployees(data || []);
        }
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);
    
    // Função para ser chamada após a importação para recarregar a folha de ponto
    const handleSuccessfulImport = () => {
        setFolhaPontoKey(Date.now()); // Muda a chave para forçar o componente a recarregar
    };

    if (isLoading) {
        return <p className="text-center mt-10">Carregando dados dos funcionários...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-red-500">{error}</p>;
    }

    return (
        <div className="space-y-6">
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}
            <h1 className="text-3xl font-bold text-gray-900">Controle de Ponto</h1>

            {/* Abas de Navegação */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('importar')}
                        className={`${
                            activeTab === 'importar'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Importar Registros
                    </button>
                    <button
                        onClick={() => setActiveTab('folha')}
                        className={`${
                            activeTab === 'folha'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Folha de Ponto e Lançamento Manual
                    </button>
                </nav>
            </div>

            {/* Conteúdo da Aba */}
            <div>
                {activeTab === 'importar' && (
                  <PontoImporter 
                    employees={employees}
                    onImport={handleSuccessfulImport} 
                    showToast={showToast}
                  />
                )}
                {activeTab === 'folha' && <FolhaPonto key={folhaPontoKey} employees={employees} />}
            </div>
        </div>
    );
}
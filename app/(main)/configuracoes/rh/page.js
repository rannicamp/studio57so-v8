'use client';

import { useState, useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBriefcase, faClock } from '@fortawesome/free-solid-svg-icons';

// Imports dos componentes das abas
import CargosManager from '@/components/configuracoes/rh/CargosManager'; 
import JornadasSection from '@/components/configuracoes/rh/JornadasSection'; // Novo componente

export default function ConfiguracoesRHPage() {
    const { setPageTitle } = useLayout();
    const [activeTab, setActiveTab] = useState('cargos');

    useEffect(() => {
        setPageTitle('Configurações de RH');
    }, [setPageTitle]);

    return (
        <div className="w-full p-6 space-y-6 animate-in fade-in duration-500">
            {/* Navegação de Abas */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit shadow-inner">
                <button
                    onClick={() => setActiveTab('cargos')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center ${
                        activeTab === 'cargos'
                            ? 'bg-white text-blue-600 shadow-sm transform scale-105'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                >
                    <FontAwesomeIcon icon={faBriefcase} className="mr-2" />
                    Cargos e Funções
                </button>
                <button
                    onClick={() => setActiveTab('jornadas')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center ${
                        activeTab === 'jornadas'
                            ? 'bg-white text-blue-600 shadow-sm transform scale-105'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                >
                    <FontAwesomeIcon icon={faClock} className="mr-2" />
                    Jornadas e Feriados
                </button>
            </div>

            {/* Conteúdo Dinâmico */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[500px]">
                {activeTab === 'cargos' && <CargosManager />}
                {activeTab === 'jornadas' && <JornadasSection />}
            </div>
        </div>
    );
}
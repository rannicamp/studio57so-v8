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
 {/* Navegação de Abas - PADRÃO OURO */}
 <div className="flex bg-gray-100/80 backdrop-blur-md p-1.5 rounded-[2rem] w-fit shadow-inner border border-gray-200/50 mb-8 mx-auto sm:mx-0">
 <button
 onClick={() => setActiveTab('cargos')}
 className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'cargos'
 ? 'bg-white text-blue-600 shadow-[0_4px_14px_0_rgba(37,99,235,0.1)] transform scale-105'
 : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
 }`}
 >
 <FontAwesomeIcon icon={faBriefcase} className={activeTab === 'cargos' ? 'text-blue-500' : 'text-gray-400'} />
 Cargos e Funções
 </button>
 <button
 onClick={() => setActiveTab('jornadas')}
 className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'jornadas'
 ? 'bg-white text-blue-600 shadow-[0_4px_14px_0_rgba(37,99,235,0.1)] transform scale-105'
 : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
 }`}
 >
 <FontAwesomeIcon icon={faClock} className={activeTab === 'jornadas' ? 'text-blue-500' : 'text-gray-400'} />
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
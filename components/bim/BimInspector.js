// Caminho: components/bim/BimInspector.js
'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faLayerGroup, faTasks } from '@fortawesome/free-solid-svg-icons';
import BimProperties from './BimProperties';
import BimElementPlanning from './BimElementPlanning';

export default function BimInspector({ 
    elementExternalId, 
    projetoBimId, 
    urnAutodesk, 
    onClose,
    onOpenLink,
    onOpenCreate 
}) {
    // Estado da Aba: 'properties' ou 'planning'
    const [activeTab, setActiveTab] = useState('properties');

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300">
            
            {/* --- HEADER DO INSPECTOR (Com Abas) --- */}
            <div className="bg-white border-b shrink-0">
                <div className="flex items-center justify-between p-2 px-3 border-b border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inspetor BIM</h3>
                    <button onClick={onClose} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                
                {/* Navegação das Abas */}
                <div className="flex">
                    <button 
                        onClick={() => setActiveTab('properties')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center justify-center gap-2
                            ${activeTab === 'properties' 
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                                : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}
                        `}
                    >
                        <FontAwesomeIcon icon={faLayerGroup} />
                        Dados
                    </button>
                    <button 
                        onClick={() => setActiveTab('planning')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center justify-center gap-2
                            ${activeTab === 'planning' 
                                ? 'border-orange-500 text-orange-600 bg-orange-50/50' 
                                : 'border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600'}
                        `}
                    >
                        <FontAwesomeIcon icon={faTasks} />
                        4D
                    </button>
                </div>
            </div>

            {/* --- ÁREA DE CONTEÚDO --- */}
            <div className="flex-1 overflow-hidden relative bg-gray-50/30">
                
                {activeTab === 'properties' && (
                    <BimProperties 
                        elementExternalId={elementExternalId}
                        projetoBimId={projetoBimId}
                        urnAutodesk={urnAutodesk}
                    />
                )}

                {activeTab === 'planning' && (
                    <BimElementPlanning 
                        elementExternalId={elementExternalId}
                        projetoBimId={projetoBimId}
                        // O nome exato pode ser buscado internamente no componente ou passado se disponível
                        elementName={`ID: ${elementExternalId.substring(0, 8)}...`} 
                        onOpenLink={onOpenLink}
                        onOpenCreate={onOpenCreate}
                    />
                )}

            </div>
        </div>
    );
}
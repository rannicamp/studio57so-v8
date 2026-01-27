// Caminho: components/bim/BimInspector.js
'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faLayerGroup, faTasks, faCamera, 
    faStickyNote 
} from '@fortawesome/free-solid-svg-icons';
import BimProperties from './BimProperties';
import BimElementPlanning from './BimElementPlanning';
import BimNotesList from './BimNotesList'; // Agora importando o arquivo correto!

export default function BimInspector({ 
    elementExternalId, 
    projetoBimId, 
    urnAutodesk, 
    onClose,
    onOpenLink,
    onOpenCreate,
    onOpenNote 
}) {
    const [activeTab, setActiveTab] = useState('properties');

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300">
            
            {/* --- HEADER --- */}
            <div className="bg-white border-b shrink-0">
                <div className="flex items-center justify-between p-2 px-3 border-b border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inspetor BIM</h3>
                    <button onClick={onClose} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                
                {/* Abas */}
                <div className="flex">
                    <button onClick={() => setActiveTab('properties')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'properties' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faLayerGroup} className="text-sm"/> Dados
                    </button>
                    <button onClick={() => setActiveTab('planning')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'planning' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faTasks} className="text-sm"/> 4D
                    </button>
                    <button onClick={() => setActiveTab('notes')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'notes' ? 'border-purple-600 text-purple-600 bg-purple-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faStickyNote} className="text-sm"/> Notas
                    </button>
                </div>
            </div>

            {/* --- CONTEÚDO --- */}
            <div className="flex-1 overflow-hidden relative bg-gray-50/30 flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'properties' && (
                        <BimProperties elementExternalId={elementExternalId} projetoBimId={projetoBimId} urnAutodesk={urnAutodesk} />
                    )}

                    {activeTab === 'planning' && (
                        <BimElementPlanning elementExternalId={elementExternalId} projetoBimId={projetoBimId} elementName={`ID: ${elementExternalId ? String(elementExternalId).substring(0, 8) : '...'}`} onOpenLink={onOpenLink} onOpenCreate={onOpenCreate} />
                    )}

                    {activeTab === 'notes' && (
                        <div className="p-2">
                            <BimNotesList onSelectNote={(note) => console.log("Nota clicada:", note)} />
                        </div>
                    )}
                </div>

                {/* --- FOOTER --- */}
                <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                    <button onClick={() => onOpenNote({ externalId: elementExternalId, projetoBimId: projetoBimId })} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-md shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faCamera} /> Criar Nova Nota
                    </button>
                </div>
            </div>
        </div>
    );
}
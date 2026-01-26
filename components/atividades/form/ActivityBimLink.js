// Caminho: components/atividades/form/ActivityBimLink.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faLink, faLayerGroup, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function ActivityBimLink({ count }) {
    // Se não tiver contagem, não renderiza nada (proteção)
    if (!count || count <= 0) return null;

    const isMultiple = count > 1;

    return (
        <div className={`rounded-lg p-3 shadow-sm border animate-in slide-in-from-top-2 duration-300 flex items-center justify-between
            ${isMultiple 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-800' // Estilo Roxo para Múltiplos
                : 'bg-blue-50 border-blue-200 text-blue-800'       // Estilo Azul para Único
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md shadow-sm ${isMultiple ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                    <FontAwesomeIcon icon={isMultiple ? faLayerGroup : faCube} className="text-lg" />
                </div>
                
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isMultiple ? 'text-indigo-400' : 'text-blue-400'}`}>
                        Contexto BIM Detectado
                    </p>
                    <p className="text-xs font-bold leading-tight">
                        Criando atividade vinculada a <span className="text-lg mx-1">{count}</span> 
                        {isMultiple ? 'elementos selecionados' : 'elemento selecionado'}.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 bg-white/60 rounded-full border border-black/5">
                <FontAwesomeIcon icon={faLink} className="text-xs opacity-70" />
                <span className="text-[10px] font-bold uppercase">Vínculo Ativo</span>
            </div>
        </div>
    );
}
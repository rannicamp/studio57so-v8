'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faCheckSquare, faSquare, faClock, faEllipsisV, 
    faCloudUploadAlt, faPen, faDatabase, faTrash,
    faCog, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const BimFileItem = React.memo(({ 
    file, 
    isActive, 
    isSelected, 
    onFileSelect, 
    onToggleModel, 
    onAction 
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const isProcessing = file.status === 'processing';
    const isError = file.status === 'Erro';

    // Fecha ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleMenuAction = (e, type) => {
        e.stopPropagation();
        e.preventDefault();
        setIsMenuOpen(false);
        onAction(type, file);
    };

    return (
        <div 
            onClick={(e) => { 
                if (isMenuOpen) return; // Se o menu tá aberto, não seleciona o arquivo
                e.stopPropagation(); 
                if(!isProcessing && !isError) onFileSelect(file); 
            }} 
            className={`group relative p-2 rounded-lg border cursor-pointer transition-all mb-1 
                ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'} 
                ${isProcessing ? 'opacity-70 cursor-wait' : 'hover:scale-[1.01]'}
                ${isMenuOpen ? 'z-50 ring-2 ring-blue-400' : 'z-10'}`} // Eleva o card quando o menu abre
        >
            <div className="flex items-start gap-2 relative">
                <button 
                    onClick={(e) => { e.stopPropagation(); if(!isProcessing && !isError) onToggleModel(file); }} 
                    className={`mt-0.5 transition-colors ${isActive ? 'text-blue-200 hover:text-white' : 'text-gray-300 hover:text-blue-500'}`}
                >
                    {isProcessing ? (
                        <FontAwesomeIcon icon={faCog} spin className="text-blue-500" />
                    ) : isError ? (
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                    ) : (
                        <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className="text-[12px]" />
                    )}
                </button>

                <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold truncate leading-tight ${isActive ? 'text-white' : 'text-gray-700'}`}>
                        {file.nome_arquivo}
                    </p>
                    <div className={`flex items-center gap-1 mt-1 text-[8px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                        {isProcessing ? "PROCESSANDO..." : <><FontAwesomeIcon icon={faClock} /> {new Date(file.criado_em).toLocaleDateString()} • v{file.versao}</>}
                    </div>
                </div>

                {!isProcessing && !isError && (
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setIsMenuOpen(!isMenuOpen); 
                            }} 
                            className={`p-1 px-2 rounded hover:bg-black/10 transition-all z-[100] ${isActive ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" />
                        </button>

                        {/* MENU COM Z-INDEX SUPREMO E POSICIONAMENTO FIXO RELATIVO */}
                        {isMenuOpen && (
                            <div 
                                className="absolute right-0 top-7 w-48 bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top-right"
                                style={{ zIndex: 9999 }} // Garante que fica por cima de TUDO
                            >
                                <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/50">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Opções do Arquivo</p>
                                </div>
                                
                                <button onClick={(e) => handleMenuAction(e, 'version')} className="w-full text-left px-4 py-2.5 text-[11px] font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-colors">
                                    <FontAwesomeIcon icon={faCloudUploadAlt} className="w-3 text-blue-400" /> Atualizar Versão
                                </button>
                                
                                <button onClick={(e) => handleMenuAction(e, 'edit')} className="w-full text-left px-4 py-2.5 text-[11px] font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-colors">
                                    <FontAwesomeIcon icon={faPen} className="w-3 text-blue-400" /> Editar / Mover
                                </button>
                                
                                <button 
                                    onClick={(e) => handleMenuAction(e, 'sync')} 
                                    className="w-full text-left px-4 py-2.5 text-[11px] font-black text-blue-700 bg-blue-50/50 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-all border-y border-blue-100"
                                >
                                    <FontAwesomeIcon icon={faDatabase} className="w-3" /> SINCRONIZAR DB
                                </button>
                                
                                <button onClick={(e) => handleMenuAction(e, 'trash')} className="w-full text-left px-4 py-2.5 text-[11px] font-semibold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors">
                                    <FontAwesomeIcon icon={faTrash} className="w-3" /> Mover p/ Lixeira
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

BimFileItem.displayName = 'BimFileItem';
export default BimFileItem;
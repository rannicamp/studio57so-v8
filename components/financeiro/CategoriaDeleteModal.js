// components/financeiro/CategoriaDeleteModal.js
"use client";

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react'; // Assumindo que você tem ou usaremos HTML nativo/Tailwind se não tiver headless
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faExchangeAlt, faEraser } from '@fortawesome/free-solid-svg-icons';

export default function CategoriaDeleteModal({ isOpen, onClose, onConfirm, categoria, allCategories }) {
    const [actionType, setActionType] = useState('orphan'); // 'orphan' ou 'migrate'
    const [targetCategoryId, setTargetCategoryId] = useState('');

    // Filtra para não mostrar a própria categoria ou filhas como opção de destino
    // (Lógica simples: remove a própria. Para remover filhas precisaria de lógica recursiva, 
    // mas remover a própria já evita o erro circular básico).
    const eligibleCategories = allCategories.filter(c => c.id !== categoria?.id && c.tipo === categoria?.tipo);

    if (!isOpen || !categoria) return null;

    const handleSubmit = () => {
        if (actionType === 'migrate' && !targetCategoryId) {
            alert("Por favor, selecione uma categoria de destino.");
            return;
        }
        // Se orphan, manda null. Se migrate, manda o ID.
        const finalTargetId = actionType === 'migrate' ? targetCategoryId : null;
        onConfirm(categoria.id, finalTargetId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-full">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-red-800">Excluir Categoria</h3>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-gray-600">
                        Você está prestes a excluir a categoria <strong className="text-gray-800">{categoria.nome}</strong>.
                    </p>
                    <p className="text-sm text-gray-500">
                        O que devemos fazer com os lançamentos vinculados a ela?
                    </p>

                    <div className="space-y-3 mt-4">
                        {/* Opção 1: Orfanar */}
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${actionType === 'orphan' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input 
                                type="radio" 
                                name="deleteAction" 
                                value="orphan" 
                                checked={actionType === 'orphan'} 
                                onChange={() => setActionType('orphan')}
                                className="mt-1 text-red-600 focus:ring-red-500"
                            />
                            <div className="ml-3">
                                <span className="block font-medium text-gray-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faEraser} className="text-gray-400" /> 
                                    Remover categoria dos lançamentos
                                </span>
                                <span className="block text-xs text-gray-500 mt-1">Os lançamentos ficarão "Sem Categoria".</span>
                            </div>
                        </label>

                        {/* Opção 2: Migrar */}
                        <label className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${actionType === 'migrate' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <input 
                                type="radio" 
                                name="deleteAction" 
                                value="migrate" 
                                checked={actionType === 'migrate'} 
                                onChange={() => setActionType('migrate')}
                                className="mt-1 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="ml-3 w-full">
                                <span className="block font-medium text-gray-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faExchangeAlt} className="text-gray-400" />
                                    Mover para outra categoria
                                </span>
                                <span className="block text-xs text-gray-500 mt-1">Escolha para onde os lançamentos vão.</span>
                                
                                {actionType === 'migrate' && (
                                    <select 
                                        className="mt-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                        value={targetCategoryId}
                                        onChange={(e) => setTargetCategoryId(e.target.value)}
                                        onClick={(e) => e.stopPropagation()} // Evita selecionar o radio de novo
                                    >
                                        <option value="">Selecione o destino...</option>
                                        {eligibleCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm shadow-sm flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faEraser} />
                        Confirmar Exclusão
                    </button>
                </div>
            </div>
        </div>
    );
}
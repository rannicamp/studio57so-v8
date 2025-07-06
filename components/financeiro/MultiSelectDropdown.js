"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faTimes } from '@fortawesome/free-solid-svg-icons';

export default function MultiSelectDropdown({ label, options, selectedIds, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const handleToggle = () => setIsOpen(!isOpen);

    const handleSelection = (optionId) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(optionId)) {
            newSelectedIds.delete(optionId);
        } else {
            newSelectedIds.add(optionId);
        }
        onChange(Array.from(newSelectedIds));
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const getDisplayName = (option) => option.nome || option.nome_fantasia || option.razao_social;

    const displayLabel = selectedIds.length > 0
        ? options.filter(o => selectedIds.includes(o.id)).map(getDisplayName).join(', ')
        : `TODOS OS ${label.toUpperCase()}`;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <label className="text-xs uppercase font-medium text-gray-600">{label}</label>
            <button
                type="button"
                onClick={handleToggle}
                className="mt-1 w-full p-2 border rounded-md shadow-sm bg-white flex justify-between items-center text-left"
            >
                <span className="truncate pr-2">{displayLabel}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                     <div className="p-2 border-b">
                        <input
                          type="text"
                          placeholder="Buscar..."
                          className="w-full p-1 border rounded"
                          // A lógica de busca dentro do dropdown pode ser adicionada aqui no futuro
                        />
                    </div>
                    {options.map(option => (
                        <label key={option.id} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(option.id)}
                                onChange={() => handleSelection(option.id)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm text-gray-700">{getDisplayName(option)}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
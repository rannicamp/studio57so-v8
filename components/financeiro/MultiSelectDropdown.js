//components\financeiro\MultiSelectDropdown.js
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

const getAllChildIds = (option) => {
    let ids = [option.id];
    if (option.children && option.children.length > 0) {
        option.children.forEach(child => {
            ids = [...ids, ...getAllChildIds(child)];
        });
    }
    return ids;
};

const Option = ({ option, selectedIds, onSelectionChange, level = 0 }) => {
    const getDisplayName = (opt) => opt.nome || opt.nome_fantasia || opt.razao_social || opt.text;

    return (
        <>
            <label 
                className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
                style={{ paddingLeft: `${1 + level * 1.5}rem` }}
            >
                <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => onSelectionChange(option)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">{getDisplayName(option)}</span>
            </label>
            {option.children && option.children.length > 0 && (
                <div>
                    {option.children.map(child => (
                        <Option 
                            key={child.id}
                            option={child}
                            selectedIds={selectedIds}
                            onSelectionChange={onSelectionChange}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

export default function MultiSelectDropdown({ 
    label, 
    options = [],         // <-- CORREÇÃO APLICADA AQUI
    selectedIds = [],     // <-- CORREÇÃO APLICADA AQUI
    onChange,
    placeholder = `Todos(as) os(as) ${label}` 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleToggle = () => setIsOpen(!isOpen);

    const handleSelection = (option) => {
        const allIdsToToggle = getAllChildIds(option);
        const currentSelected = new Set(selectedIds);
        
        const isCurrentlySelected = currentSelected.has(option.id);

        if (isCurrentlySelected) {
            allIdsToToggle.forEach(id => currentSelected.delete(id));
        } else {
            allIdsToToggle.forEach(id => currentSelected.add(id));
        }
        
        onChange(Array.from(currentSelected));
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
    
    const flattenOptions = useCallback((opts) => {
        let flat = [];
        // A verificação 'opts &&' garante que não tentaremos iterar sobre undefined
        opts && opts.forEach(o => {
            flat.push(o);
            if (o.children) {
                flat = flat.concat(flattenOptions(o.children));
            }
        });
        return flat;
    }, []);
    
    const allOptionsFlat = useMemo(() => flattenOptions(options), [options, flattenOptions]);

    const getDisplayName = (option) => option.nome || option.nome_fantasia || option.razao_social || option.text;

    const displayLabel = selectedIds.length > 0
        ? allOptionsFlat.filter(o => selectedIds.includes(o.id)).map(getDisplayName).join(', ')
        : placeholder;

    const filterOptions = (opts, term) => {
        if (!term) return opts;
        
        const lowerTerm = term.toLowerCase();

        // A verificação 'opts &&' garante que não tentaremos dar reduce em undefined
        return opts ? opts.reduce((acc, option) => {
            const displayName = (getDisplayName(option) || '').toLowerCase();
            const hasChildren = option.children && option.children.length > 0;

            const childrenMatch = hasChildren ? filterOptions(option.children, term) : [];
            
            if (displayName.includes(lowerTerm) || childrenMatch.length > 0) {
                acc.push({ ...option, children: childrenMatch });
            }
            
            return acc;
        }, []) : [];
    };
    
    const filteredOptions = filterOptions(options, searchTerm);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <label className="text-xs uppercase font-medium text-gray-600">{label}</label>
            <button
                type="button"
                onClick={handleToggle}
                className="mt-1 w-full p-2 border rounded-md shadow-sm bg-white flex justify-between items-center text-left h-[42px]"
            >
                <span className="truncate pr-2">{displayLabel}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                     <div className="p-2 border-b">
                         <input
                             type="text"
                             placeholder="Buscar..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             className="w-full p-1 border rounded"
                         />
                     </div>
                     {filteredOptions.map(option => (
                         <Option 
                             key={option.id}
                             option={option}
                             selectedIds={selectedIds}
                             onSelectionChange={handleSelection}
                         />
                     ))}
                </div>
            )}
        </div>
    );
}
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

    if (option.isGroupLabel) {
        return (
            <>
                <div
                    className="flex items-center px-4 py-1.5 mt-2 bg-gray-50/80 border-y border-gray-100"
                    style={{ paddingLeft: `${1 + level * 1.5}rem` }}
                >
                    <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">{getDisplayName(option)}</span>
                </div>
                {option.children && option.children.length > 0 && (
                    <div className="pb-1">
                        {option.children.map(child => (
                            <Option
                                key={child.id}
                                option={child}
                                selectedIds={selectedIds}
                                onSelectionChange={onSelectionChange}
                                level={level}
                            />
                        ))}
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            <label
                className="flex items-center px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                style={{ paddingLeft: `${1 + level * 1.5}rem` }}
            >
                <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => onSelectionChange(option)}
                    className="h-4 w-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer"
                />
                <span className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors flex-1 truncate">{getDisplayName(option)}</span>
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
        ? allOptionsFlat.filter(o => !o.isGroupLabel && selectedIds.includes(o.id)).map(getDisplayName).join(', ')
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
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
            <button
                type="button"
                onClick={handleToggle}
                className={`w-full p-2.5 border rounded-xl shadow-inner flex justify-between items-center text-left h-[44px] transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 ${isOpen ? 'bg-white border-blue-300 ring-2 ring-blue-50' : 'bg-gray-50 border-gray-200 hover:bg-gray-100/50'}`}
            >
                <span className="truncate pr-2 text-sm font-bold text-gray-700">{displayLabel}</span>
                <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-30 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
                    <div className="p-3 border-b border-gray-50 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                        <input
                            type="text"
                            placeholder="Buscar opções..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 text-sm font-bold text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-colors"
                        />
                    </div>
                    <div className="py-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(option => (
                            <Option
                                key={option.id}
                                option={option}
                                selectedIds={selectedIds}
                                onSelectionChange={handleSelection}
                            />
                        )) : (
                            <div className="p-4 text-center text-xs font-semibold text-gray-400">
                                Nenhum resultado encontrado.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
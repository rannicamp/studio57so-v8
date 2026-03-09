// components/financeiro/SelectConta.js
"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faLandmark, faWallet, faCreditCard, faMoneyBill } from '@fortawesome/free-solid-svg-icons';

export default function SelectConta({ contas, value, onChange, name, placeholder = "Selecione a conta...", className = "", disabled = false, required = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedConta = contas?.find(c => String(c.id) === String(value));

    // Clique fora fecha o dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (conta) => {
        setIsOpen(false);
        // Cria um evento falso para compatibilidade com o handleChange nativo
        onChange({
            target: {
                name,
                value: conta.id
            }
        });
    };

    const getIcon = (tipo) => {
        if (tipo === 'Cartão de Crédito') return faCreditCard;
        if (tipo?.toLowerCase().includes('dinheiro')) return faMoneyBill;
        if (tipo?.toLowerCase().includes('ativo') || tipo?.toLowerCase().includes('passivo')) return faLandmark;
        return faWallet;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Input fantasma para suportar o required do formulário nativo HTML5 */}
            {required && (
                <input
                    type="text"
                    tabIndex={-1}
                    value={value || ''}
                    required={required}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    onChange={() => { }}
                />
            )}

            <button
                type="button"
                className={`w-full flex items-center justify-between p-2 border rounded-md bg-white text-left transition-colors ${disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500 border-gray-200' : 'cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                {selectedConta ? (
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-800 truncate">{selectedConta.nome}</span>
                        {(selectedConta.agencia || selectedConta.numero_conta) && (
                            <span className="text-xs text-gray-500 truncate mt-0.5 font-mono">
                                Ag: {selectedConta.agencia || '-'} | Cc: {selectedConta.numero_conta || '-'}
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-gray-400">{placeholder}</span>
                )}
                <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ml-2 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                    {contas?.length > 0 ? contas.map(conta => (
                        <li
                            key={conta.id}
                            onClick={() => handleSelect(conta)}
                            className={`p-3 cursor-pointer transition-colors flex items-start gap-3 hover:bg-blue-50 ${String(value) === String(conta.id) ? 'bg-blue-100/50' : ''}`}
                        >
                            <div className="mt-1 flex-shrink-0 text-gray-400 w-5 text-center">
                                <FontAwesomeIcon icon={getIcon(conta.tipo)} />
                            </div>
                            <div className="flex flex-col flex-grow min-w-0">
                                <span className="font-semibold text-gray-800 text-sm truncate">{conta.nome}</span>
                                {(conta.agencia || conta.numero_conta) ? (
                                    <span className="text-xs text-gray-500 mt-0.5 truncate font-mono">
                                        {conta.instituicao && <span className="mr-1 text-gray-400 font-sans">{conta.instituicao} •</span>}
                                        Ag: {conta.agencia || '-'} | Cc: {conta.numero_conta || '-'}
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-400 mt-0.5 truncate">{conta.tipo || 'Conta Financeira'}</span>
                                )}
                            </div>
                        </li>
                    )) : (
                        <li className="p-4 text-center text-sm text-gray-500">Nenhuma conta disponível</li>
                    )}
                </ul>
            )}
        </div>
    );
}

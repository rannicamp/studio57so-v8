// components/financeiro/conciliacao/ConciliacaoHeader.js
"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEraser, faSpinner, faMagic, faCreditCard, faFileCode, faPaste, faCalendarCheck, faCalendarTimes } from '@fortawesome/free-solid-svg-icons';

export default function ConciliacaoHeader({
    contas,
    selectedContaId,
    setSelectedContaId,
    isCartaoCredito,
    inputMode,
    setInputMode,
    file,
    setFile,
    pastedText,
    setPastedText,
    isProcessing,
    onProcess,
    onReset
}) {
    // Pega os detalhes da conta selecionada para mostrar os dias
    const selectedContaData = useMemo(() => 
        contas.find(c => c.id == selectedContaId), 
    [contas, selectedContaId]);

    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna 1: Conta */}
                <div>
                    <label className="block text-sm font-bold text-gray-700">1. Selecione a Conta</label>
                    <select 
                        value={selectedContaId} 
                        onChange={(e) => setSelectedContaId(e.target.value)} 
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Escolha uma conta --</option>
                        {contas.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                        ))}
                    </select>
                    
                    {isCartaoCredito && (
                        <div className="space-y-2 mt-2 animate-fade-in">
                            <div className="bg-orange-50 text-orange-800 text-xs p-2 rounded flex items-center gap-2 font-bold border border-orange-100">
                                <FontAwesomeIcon icon={faCreditCard} /> 
                                MODO CARTÃO ATIVO: Usando Data da Transação.
                            </div>
                            
                            {(selectedContaData?.dia_fechamento_fatura || selectedContaData?.dia_pagamento_fatura) && (
                                <div className="flex gap-2 text-xs">
                                    <div className="flex-1 bg-gray-50 border border-gray-200 p-2 rounded text-gray-600 flex items-center justify-center gap-2" title="Melhor dia de compra">
                                        <FontAwesomeIcon icon={faCalendarTimes} className="text-red-400"/>
                                        Fechamento: <span className="font-bold text-gray-800">Dia {selectedContaData.dia_fechamento_fatura || '--'}</span>
                                    </div>
                                    <div className="flex-1 bg-gray-50 border border-gray-200 p-2 rounded text-gray-600 flex items-center justify-center gap-2" title="Dia do vencimento">
                                        <FontAwesomeIcon icon={faCalendarCheck} className="text-green-500"/>
                                        Vencimento: <span className="font-bold text-gray-800">Dia {selectedContaData.dia_pagamento_fatura || '--'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Coluna 2: Importação */}
                <div>
                    <label className="block text-sm font-bold text-gray-700">2. Importar Dados</label>
                    <div className="flex gap-2 mb-2">
                        <button 
                            onClick={() => setInputMode('ofx')} 
                            className={`flex-1 text-xs py-1 rounded-t-md border ${inputMode === 'ofx' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FontAwesomeIcon icon={faFileCode} className="mr-2"/> Arquivo OFX
                        </button>
                        <button 
                            onClick={() => setInputMode('csv')} 
                            className={`flex-1 text-xs py-1 rounded-t-md border ${inputMode === 'csv' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FontAwesomeIcon icon={faPaste} className="mr-2"/> Colar Texto
                        </button>
                    </div>
                    
                    <div className={`border rounded-b-md p-3 bg-white ${inputMode === 'csv' ? 'rounded-tr-md' : ''}`}>
                        {inputMode === 'ofx' ? (
                            <input 
                                id="file-input" 
                                type="file" 
                                onChange={(e) => { if(e.target.files[0]) setFile(e.target.files[0]); }} 
                                accept=".ofx,.ofc" 
                                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                            />
                        ) : (
                            <textarea 
                                placeholder="Cole aqui as linhas do seu CSV (Data;Descrição;Valor)..." 
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                className="w-full h-16 p-2 text-xs border rounded-md font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
                <button onClick={onReset} className="text-sm text-gray-600 hover:text-red-600 font-semibold flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                    <FontAwesomeIcon icon={faEraser} /> Limpar Tudo
                </button>
                <button 
                    onClick={onProcess} 
                    disabled={isProcessing || !selectedContaId || (inputMode === 'ofx' && !file) || (inputMode === 'csv' && !pastedText)} 
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 shadow-sm font-bold transition-transform active:scale-95"
                >
                    {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin/> : <FontAwesomeIcon icon={faMagic}/>} 
                    {isProcessing ? 'Lendo...' : 'Processar'}
                </button>
            </div>
        </div>
    );
}
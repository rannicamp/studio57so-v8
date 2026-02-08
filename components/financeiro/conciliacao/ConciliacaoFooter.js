"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faTimes, faCalculator, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function ConciliacaoFooter({ 
    calculadora, 
    matchesCount, 
    onProceedMatch, 
    onCancelSelection, 
    onConfirmAll,
    isProcessing 
}) {
    // Se não tiver nada selecionado nem matches, não mostra nada
    if (!calculadora && matchesCount === 0) return null;

    return (
        <>
            {/* Calculadora Flutuante */}
            {(matchesCount > 0 || calculadora) && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white p-4 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50 animate-slide-up">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        
                        {calculadora ? (
                            <div className={`flex items-center gap-4 px-4 py-2 rounded-lg border-2 ${calculadora.isMatch ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                                <div className="flex flex-col items-end border-r pr-4 border-gray-300">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Alvo (Extrato)</span>
                                    <span className="font-mono font-bold text-lg text-gray-800">{formatCurrency(calculadora.target)}</span>
                                </div>
                                <div className="flex flex-col items-end border-r pr-4 border-gray-300">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Soma Seleção</span>
                                    <span className="font-mono font-bold text-lg text-blue-700">{formatCurrency(calculadora.totalSistema)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Diferença</span>
                                    <span className={`font-mono font-bold text-lg ${calculadora.diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(calculadora.diff)}
                                    </span>
                                </div>

                                {calculadora.isMatch ? (
                                    <button onClick={onProceedMatch} className="ml-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-bold flex items-center gap-2 animate-pulse shadow-md">
                                        <FontAwesomeIcon icon={faLink} /> Conciliar
                                    </button>
                                ) : (
                                    <div className="ml-4 text-red-500 text-xs font-bold max-w-[100px] text-center leading-tight">Diferença encontrada</div>
                                )}
                                
                                <button onClick={onCancelSelection} className="ml-2 text-gray-400 hover:text-gray-600 px-2">
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm italic flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
                                <FontAwesomeIcon icon={faCalculator} /> Selecione itens para conciliar manualmente.
                            </div>
                        )}

                        {/* Botão de Confirmar Tudo */}
                        {matchesCount > 0 && !calculadora && (
                            <button 
                                onClick={onConfirmAll} 
                                disabled={isProcessing} 
                                className="bg-blue-800 text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-blue-900 disabled:bg-gray-400 flex items-center gap-3 shadow-lg transform transition hover:-translate-y-1"
                            >
                                <FontAwesomeIcon icon={faCheckCircle} /> Confirmar {matchesCount} Conciliações
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Ação rápida para confirmar só a seleção se não houver conflitos (Opcional, mas estava no original) */}
            {calculadora && calculadora.isMatch && (
                 <div className="hidden">Botão extra oculto, usando o da barra acima</div>
            )}
        </>
    );
}
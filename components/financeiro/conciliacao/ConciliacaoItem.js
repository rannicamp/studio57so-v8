"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPenToSquare, faTrash, faUndo, faTimes, faCheckCircle, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';

const formatDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.split('T')[0])) return 'N/A';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const getColorForPair = (pairId) => {
    const colors = ['border-yellow-400 bg-yellow-100', 'border-purple-400 bg-purple-100', 'border-pink-400 bg-pink-100', 'border-indigo-400 bg-indigo-100', 'border-teal-400 bg-teal-100'];
    return colors[pairId % colors.length];
};

export default function ConciliacaoItem({ 
    item, 
    type, 
    listName, 
    isSelected, 
    match, 
    isCartaoCredito, 
    getDisplayDate,
    onItemClick,
    onAction
}) {
    let bg = 'bg-white hover:bg-gray-50';
    if (isSelected) bg = 'ring-2 ring-blue-500 bg-blue-50';
    if (match) bg = getColorForPair(match.pairId);
    if (item.conciliationStatus === 'dbConciliated') bg = 'bg-green-50 opacity-60';

    const isReceita = (type === 'sistema' ? item.tipo === 'Receita' : item.valor > 0);
    const valorClass = isReceita ? 'text-green-600' : 'text-red-600';
    const dataExibicao = type === 'sistema' ? getDisplayDate(item) : item.data;

    return (
        <div 
            onClick={() => onItemClick(item, listName)}
            className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md mb-1 transition-all cursor-pointer ${bg}`}
        >
            <div className="col-span-3 text-xs text-gray-600 flex items-center gap-1">
                {formatDate(dataExibicao)}
                {type === 'sistema' && isCartaoCredito && (
                    <FontAwesomeIcon icon={faCalendarCheck} className="text-orange-400" title="Data da Transação (Cartão)" />
                )}
            </div>
            <div className="col-span-5 truncate font-medium" title={item.descricao}>
                {item.descricao}
            </div>
            <div className={`col-span-2 text-right font-bold ${valorClass}`}>
                {formatCurrency(item.valor)}
            </div>
            
            <div className="col-span-2 flex justify-end gap-2 items-center">
                {/* Ações do Extrato */}
                {type === 'extrato' && !match && item.conciliationStatus === 'pendente' && (
                    <button onClick={(e) => { e.stopPropagation(); onAction('create', item); }} className="text-blue-600 bg-blue-100 p-1 rounded hover:bg-blue-200">
                        <FontAwesomeIcon icon={faPlus}/>
                    </button>
                )}
                {type === 'extrato' && item.conciliationStatus === 'dbConciliated' && (
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                )}

                {/* Ações do Sistema */}
                {type === 'sistema' && (
                    <>
                        {item.conciliationStatus === 'pendente' && !match && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onAction('edit', item); }} className="text-blue-500 hover:text-blue-700 px-1">
                                    <FontAwesomeIcon icon={faPenToSquare}/>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onAction('delete', item); }} className="text-red-500 hover:text-red-700 px-1">
                                    <FontAwesomeIcon icon={faTrash}/>
                                </button>
                            </>
                        )}
                        {item.conciliationStatus === 'dbConciliated' && (
                            <button onClick={(e) => { e.stopPropagation(); onAction('undo', item); }} className="text-gray-400 hover:text-blue-500 px-1">
                                <FontAwesomeIcon icon={faUndo}/>
                            </button>
                        )}
                    </>
                )}

                {/* Ação de Desfazer Match da Sessão */}
                {match && (
                    <button onClick={(e)=>{ e.stopPropagation(); onAction('removeMatch', match); }} className="text-gray-400 hover:text-red-500">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                )}
            </div>
        </div>
    );
}
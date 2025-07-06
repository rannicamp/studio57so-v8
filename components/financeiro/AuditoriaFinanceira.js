"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCopy, faExclamationTriangle, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR') : 'N/A';

// Componente para um grupo de duplicatas
const DuplicateGroup = ({ group, onDelete }) => {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="pb-2 mb-2 border-b">
                <p className="font-bold text-gray-800">{group[0].descricao}</p>
                <p className="text-sm text-gray-600">
                    Valor: <span className="font-semibold">{formatCurrency(group[0].valor)}</span> | 
                    Data: <span className="font-semibold">{formatDate(group[0].data_transacao)}</span>
                </p>
            </div>
            <div className="space-y-2">
                {group.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded-md shadow-sm">
                        <div>
                            <span className="text-xs text-gray-500">ID: {item.id}</span>
                            <p className="text-sm">Conta: <span className="font-medium">{item.conta?.nome || 'N/A'}</span></p>
                        </div>
                        <button 
                            onClick={() => onDelete(item.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-600"
                            title="Excluir este lançamento"
                        >
                            <FontAwesomeIcon icon={faTrash} /> Excluir
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default function AuditoriaFinanceira() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('duplicatas');
    
    const [duplicateGroups, setDuplicateGroups] = useState([]);

    useEffect(() => {
        if (activeTab === 'duplicatas') {
            findDuplicates();
        }
    }, [activeTab]);

    const findDuplicates = async () => {
        setLoading(true);
        setMessage('');
        
        const { data, error } = await supabase.rpc('encontrar_lancamentos_duplicados');

        if (error) {
            setMessage("Erro ao buscar duplicatas: " + error.message);
        } else {
            // Agrupar os resultados por chave de duplicata
            const groups = data.reduce((acc, item) => {
                const key = item.chave_duplicata;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(item);
                return acc;
            }, {});
            setDuplicateGroups(Object.values(groups));
        }
        setLoading(false);
    };

    const handleDeleteLancamento = async (id) => {
        if (!window.confirm(`Tem certeza que deseja excluir o lançamento com ID ${id}? Esta ação não pode ser desfeita.`)) return;

        const { error } = await supabase.from('lancamentos').delete().eq('id', id);

        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage("Lançamento excluído com sucesso. Atualizando a lista...");
            findDuplicates(); // Re-busca os dados para atualizar a lista
        }
    };


    return (
        <div className="space-y-4">
            <div className="border-b">
                <nav className="-mb-px flex space-x-6">
                    <button 
                        onClick={() => setActiveTab('duplicatas')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'duplicatas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Lançamentos Duplicados
                    </button>
                    {/* Futuras abas de auditoria podem ser adicionadas aqui */}
                </nav>
            </div>

            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

            {loading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>
            ) : (
                <>
                    {activeTab === 'duplicatas' && (
                        <div>
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex items-start gap-3 text-sm mb-6">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="mt-1"/>
                                <div>
                                    <h4 className="font-bold">Atenção</h4>
                                    <p>Abaixo estão os grupos de lançamentos com a mesma descrição, valor e data. Revise cada um com cuidado antes de excluir.</p>
                                </div>
                            </div>
                            {duplicateGroups.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {duplicateGroups.map(group => (
                                        <DuplicateGroup key={group[0].chave_duplicata} group={group} onDelete={handleDeleteLancamento} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-10 text-gray-500">Nenhum lançamento duplicado encontrado!</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
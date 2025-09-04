"use client";

import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faTrash } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export default function AuditoriaFinanceira() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('duplicatas');
    
    const [duplicateGroups, setDuplicateGroups] = useState([]);

    const findDuplicates = useCallback(async () => {
        setLoading(true);
        setMessage('');
        
        const { data, error } = await supabase.rpc('encontrar_lancamentos_duplicados');

        if (error) {
            setMessage("Erro ao buscar duplicatas: " + error.message);
        } else {
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
    }, [supabase]);

    useEffect(() => {
        if (activeTab === 'duplicatas') {
            findDuplicates();
        }
    }, [activeTab, findDuplicates]);

    const handleDeleteLancamento = async (id) => {
        if (!window.confirm(`Tem certeza que deseja excluir o lançamento com ID ${id}? Esta ação não pode ser desfeita.`)) return;

        const { error } = await supabase.from('lancamentos').delete().eq('id', id);

        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage("Lançamento excluído com sucesso. Atualizando a lista...");
            findDuplicates();
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
                                    <p>Abaixo estão os grupos de lançamentos com os mesmos dados. Revise cada um com cuidado antes de excluir.</p>
                                </div>
                            </div>
                            {duplicateGroups.length > 0 ? (
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold uppercase">Data</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase">Descrição</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase">Favorecido</th>
                                                <th className="px-4 py-3 text-left font-bold uppercase">Conta</th>
                                                <th className="px-4 py-3 text-right font-bold uppercase">Valor</th>
                                                <th className="px-4 py-3 text-center font-bold uppercase">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {duplicateGroups.map((group, groupIndex) => (
                                                <Fragment key={group[0].chave_duplicata}>
                                                    {group.map((item, itemIndex) => {
                                                        const valorCor = item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600';
                                                        const favorecidoNome = item.favorecido_contatos?.nome || item.favorecido_contatos?.razao_social || 'N/A';
                                                        
                                                        return (
                                                            <tr key={item.id} className={itemIndex === 0 ? 'border-t-4 border-blue-200' : ''}>
                                                                <td className="px-4 py-2">{formatDate(item.data_transacao)}</td>
                                                                <td className="px-4 py-2">{item.descricao}</td>
                                                                <td className="px-4 py-2 text-gray-600">{favorecidoNome}</td>
                                                                <td className="px-4 py-2 text-gray-600">{item.contas_financeiras?.nome || 'N/A'}</td>
                                                                <td className={`px-4 py-2 text-right font-semibold ${valorCor}`}>{formatCurrency(item.valor)}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <button
                                                                        onClick={() => handleDeleteLancamento(item.id)}
                                                                        className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-600"
                                                                        title="Excluir este lançamento"
                                                                    >
                                                                        <FontAwesomeIcon icon={faTrash} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-center py-10 text-gray-500">Nenhum lançamento duplicado encontrado com os novos critérios!</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
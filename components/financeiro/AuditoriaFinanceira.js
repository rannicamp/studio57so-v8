"use client";

import { useState, useCallback, Fragment } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faTrash, faSearch, faCheck } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const criteriaOptions = [
    { key: 'valor', label: 'Valor' },
    { key: 'data_transacao', label: 'Data' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'conta_id', label: 'Conta' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'favorecido_contato_id', label: 'Favorecido' },
];

export default function AuditoriaFinanceira() {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [searchPerformed, setSearchPerformed] = useState(false);
    
    const [criteria, setCriteria] = useState({
        valor: true,
        data_transacao: true,
        descricao: true,
        conta_id: false,
        tipo: false,
        favorecido_contato_id: false,
    });

    const handleCriteriaChange = (key) => {
        setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const findDuplicates = useCallback(async () => {
        setLoading(true);
        setMessage('');
        setDuplicateGroups([]);
        setSearchPerformed(true);

        const activeCriteria = Object.keys(criteria).filter(key => criteria[key]);

        if (activeCriteria.length < 2) {
            setMessage("Selecione pelo menos 2 critérios para buscar duplicatas.");
            setLoading(false);
            return;
        }
        
        const { data, error } = await supabase.rpc('encontrar_duplicatas_dinamico', { p_criterios: activeCriteria });

        if (error) {
            setMessage("Erro ao buscar duplicatas: " + error.message);
        } else {
            const groups = data.reduce((acc, item) => {
                const key = item.chave_duplicata;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {});
            setDuplicateGroups(Object.values(groups));
        }
        setLoading(false);
    }, [supabase, criteria]);

    const handleDeleteLancamento = async (id) => {
        if (!window.confirm(`Tem certeza que deseja excluir o lançamento com ID ${id}? Esta ação não pode ser desfeita.`)) return;

        const { error } = await supabase.from('lancamentos').delete().eq('id', id);

        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage("Lançamento excluído com sucesso.");
            const newGroups = duplicateGroups.map(group => group.filter(item => item.id !== id)).filter(group => group.length > 1);
            setDuplicateGroups(newGroups);
        }
    };

    // --- NOVA FUNÇÃO PARA MARCAR COMO VERIFICADO ---
    const handleMarkAsVerified = async (id) => {
        // Remove o item da tela imediatamente para o usuário ver a ação
        const newGroups = duplicateGroups.map(group => group.filter(item => item.id !== id)).filter(group => group.length > 1);
        setDuplicateGroups(newGroups);
        
        const { error } = await supabase
            .from('lancamentos')
            .update({ auditoria_verificado: true })
            .eq('id', id);

        if (error) {
            setMessage(`Erro ao marcar como verificado: ${error.message}`);
            findDuplicates(); // Recarrega os dados em caso de erro
        } else {
            setMessage(`Lançamento ID ${id} marcado como verificado e não aparecerá em buscas futuras.`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                <h3 className="font-semibold text-gray-800">Critérios para Duplicatas</h3>
                <p className="text-sm text-gray-600">Marque os campos que devem ser idênticos para um lançamento ser considerado duplicado. (Mínimo 2)</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {criteriaOptions.map(option => (
                        <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={criteria[option.key]}
                                onChange={() => handleCriteriaChange(option.key)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-700">{option.label}</span>
                        </label>
                    ))}
                </div>
                <div className="pt-3 text-right">
                    <button
                        onClick={findDuplicates}
                        disabled={loading}
                        className="bg-blue-600 text-white font-bold px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                        {loading ? 'Buscando...' : 'Buscar Duplicatas'}
                    </button>
                </div>
            </div>

            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}
            
            {loading && (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>
            )}

            {!loading && searchPerformed && (
                <div>
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
                                    {duplicateGroups.map((group) => (
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
                                                            {/* --- NOVO BOTÃO DE VERIFICAR --- */}
                                                            <button
                                                                onClick={() => handleMarkAsVerified(item.id)}
                                                                className="text-green-500 hover:text-green-700 w-8 h-8 rounded-full hover:bg-green-100"
                                                                title="Marcar como verificado (não é duplicata)"
                                                            >
                                                                <FontAwesomeIcon icon={faCheck} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteLancamento(item.id)}
                                                                className="text-red-500 hover:text-red-700 w-8 h-8 rounded-full hover:bg-red-100"
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
                        <p className="text-center py-10 text-gray-500">Nenhum lançamento duplicado encontrado com os critérios selecionados.</p>
                    )}
                </div>
            )}
        </div>
    );
}
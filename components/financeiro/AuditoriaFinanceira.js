//components\financeiro\AuditoriaFinanceira.js
"use client";

import { useState, useCallback, Fragment } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faTrash, faSearch, faCheck } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// ATUALIZAÇÃO DA REGRA DE DATAS
const formatDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

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
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [criteria, setCriteria] = useState({
        valor: true, data_transacao: true, descricao: true,
        conta_id: false, tipo: false, favorecido_contato_id: false,
    });

    const activeCriteria = Object.keys(criteria).filter(key => criteria[key]);

    const { data: duplicateGroups = [], isFetching, refetch } = useQuery({
        queryKey: ['auditoriaDuplicatas', activeCriteria, organizacaoId],
        queryFn: async () => {
            if (activeCriteria.length < 2) {
                toast.warning("Selecione pelo menos 2 critérios para buscar duplicatas.");
                return [];
            }
            if (!organizacaoId) throw new Error("Organização não identificada.");

            const { data, error } = await supabase.rpc('encontrar_duplicatas_dinamico', { 
                p_criterios: activeCriteria,
                p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
            });

            if (error) throw new Error("Erro ao buscar duplicatas: " + error.message);
            
            const groups = (data || []).reduce((acc, item) => {
                const key = item.chave_duplicata;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {});
            
            const result = Object.values(groups);
            toast.info(result.length > 0 ? `${result.length} grupos de duplicatas encontrados.` : 'Nenhuma duplicata encontrada.');
            return result;
        },
        enabled: false, // Só executa quando `refetch` é chamado
        refetchOnWindowFocus: false,
    });

    const mutation = useMutation({
        mutationFn: async ({ action, id }) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            let query;
            if (action === 'delete') {
                query = supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
            } else if (action === 'verify') {
                query = supabase.from('lancamentos').update({ auditoria_verificado: true }).eq('id', id).eq('organizacao_id', organizacaoId);
            }
            const { error } = await query;
            if (error) throw error;
            return { action, id };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auditoriaDuplicatas', activeCriteria, organizacaoId] });
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleDeleteLancamento = (id) => {
        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir o lançamento com ID ${id}? Esta ação não pode ser desfeita.`,
            action: {
                label: "Excluir",
                onClick: () => toast.promise(mutation.mutateAsync({ action: 'delete', id }), {
                    loading: 'Excluindo...',
                    success: 'Lançamento excluído!',
                    error: (err) => err.message
                })
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    const handleMarkAsVerified = (id) => {
        toast.promise(mutation.mutateAsync({ action: 'verify', id }), {
            loading: 'Marcando como verificado...',
            success: `Lançamento ID ${id} verificado!`,
            error: (err) => err.message
        });
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
                                onChange={() => setCriteria(prev => ({ ...prev, [key]: !prev[key] }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-700">{option.label}</span>
                        </label>
                    ))}
                </div>
                <div className="pt-3 text-right">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="bg-blue-600 text-white font-bold px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {isFetching ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                        {isFetching ? 'Buscando...' : 'Buscar Duplicatas'}
                    </button>
                </div>
            </div>
            
            {isFetching && <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x"/></div>}

            {!isFetching && duplicateGroups.length > 0 && (
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
            )}

            {!isFetching && duplicateGroups.length === 0 && (
                <p className="text-center py-10 text-gray-500">Nenhum lançamento duplicado encontrado com os critérios selecionados.</p>
            )}
        </div>
    );
}
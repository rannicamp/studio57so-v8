"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash, faCopy, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function ContratoList({ contratos, sortConfig, requestSort, onUpdate }) {
    const router = useRouter();
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [editingStatusId, setEditingStatusId] = useState(null);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, newStatus }) => {
            const { error } = await supabase
                .from('contratos')
                .update({ status_contrato: newStatus })
                .eq('id', id)
                .eq('organizacao_id', organizacaoId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Status do contrato atualizado!");
            if (onUpdate) onUpdate();
        },
        onError: (error) => {
            toast.error(`Falha ao atualizar status: ${error.message}`);
        },
        onSettled: () => {
            setEditingStatusId(null);
        }
    });

    const handleStatusChange = (id, newStatus) => {
        updateStatusMutation.mutate({ id, newStatus });
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const handleDuplicate = (e, contrato) => {
        e.stopPropagation();
        toast.promise(supabase.rpc('duplicar_contrato_e_detalhes', { p_contrato_id: contrato.id, p_organizacao_id: organizacaoId }), {
            loading: 'Duplicando contrato...',
            success: () => { if(onUpdate) onUpdate(); return "Contrato duplicado!"; },
            error: (err) => `Erro: ${err.message}`
        });
    };

    const handleDelete = (e, contrato) => {
        e.stopPropagation();
        toast.promise(supabase.rpc('excluir_contrato_e_liberar_unidade', { p_contrato_id: contrato.id, p_organizacao_id: organizacaoId }), {
            loading: 'Excluindo contrato...',
            success: () => { if(onUpdate) onUpdate(); return "Contrato excluído!"; },
            error: (err) => `Erro: ${err.message}`
        });
    };

    const SortableHeader = ({ label, sortKey }) => (
        <th className="px-6 py-3 text-left text-xs font-medium uppercase">
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2">
                {label}
                <FontAwesomeIcon icon={sortConfig.key === sortKey ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort} className="text-gray-400" />
            </button>
        </th>
    );
    
    const statusOptions = ['Em assinatura', 'Assinado', 'Distratado', 'Finalizado'];
    const getStatusClass = (status) => {
        switch (status) {
            case 'Assinado': return 'bg-green-100 text-green-800';
            case 'Distratado': return 'bg-red-100 text-red-800';
            case 'Finalizado': return 'bg-blue-100 text-blue-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* ===== MUDANÇA 1: O botão agora ordena pela coluna `numero_contrato` ===== */}
                            <SortableHeader label="Nº Contrato" sortKey="numero_contrato" />
                            <SortableHeader label="Cliente" sortKey="contato_id" />
                            <SortableHeader label="Produto" sortKey="produto_id" />
                            <SortableHeader label="Empreendimento" sortKey="empreendimento_id" />
                            <SortableHeader label="Data da Venda" sortKey="data_venda" />
                            <SortableHeader label="Status" sortKey="status_contrato" />
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase">
                                <button onClick={() => requestSort('valor_final_venda')} className="flex items-center gap-2 ml-auto">
                                    Valor
                                    <FontAwesomeIcon icon={sortConfig.key === 'valor_final_venda' ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort} className="text-gray-400" />
                                </button>
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {contratos.length > 0 ? contratos.map((contrato) => (
                            <tr key={contrato.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/contratos/${contrato.id}`)}>
                                {/* ===== MUDANÇA 2: Agora exibimos o `numero_contrato` ou o ID se ainda não houver número ===== */}
                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-700">{contrato.numero_contrato || `(Rascunho #${contrato.id})`}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.contato?.nome || contrato.contato?.razao_social || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {contrato.contrato_produtos && contrato.contrato_produtos.length > 0
                                        ? contrato.contrato_produtos
                                            .map(cp => cp.produtos_empreendimento?.unidade || '?')
                                            .join(', ')
                                        : 'N/A'
                                    }
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">{contrato.empreendimento?.nome || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{formatDate(contrato.data_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    {editingStatusId === contrato.id ? (
                                        <select
                                            defaultValue={contrato.status_contrato}
                                            onChange={(e) => handleStatusChange(contrato.id, e.target.value)}
                                            onBlur={() => setEditingStatusId(null)}
                                            className="p-1 border rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        >
                                            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    ) : (
                                        <span
                                            onClick={() => setEditingStatusId(contrato.id)}
                                            className={`px-2 py-1 font-semibold leading-tight rounded-full text-xs cursor-pointer ${getStatusClass(contrato.status_contrato)}`}
                                        >
                                            {contrato.status_contrato}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">{formatCurrency(contrato.valor_final_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={(e) => { e.stopPropagation(); router.push(`/contratos/${contrato.id}`); }} className="text-blue-600 hover:text-blue-800" title="Visualizar/Editar Contrato"><FontAwesomeIcon icon={faEye} /></button>
                                        <button onClick={(e) => handleDuplicate(e, contrato)} className="text-gray-500 hover:text-gray-700" title="Duplicar Contrato"><FontAwesomeIcon icon={faCopy} /></button>
                                        <button onClick={(e) => handleDelete(e, contrato)} className="text-red-600 hover:text-red-800" title="Excluir Contrato"><FontAwesomeIcon icon={faTrash} /></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="8" className="text-center py-10 text-gray-500">Nenhum contrato encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
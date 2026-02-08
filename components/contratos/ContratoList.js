// components/contratos/ContratoList.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faTrash, faCopy, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import { updateContratoStatus } from '../../app/(main)/contratos/actions'; 
import { createClient } from '../../utils/supabase/client';

// Função auxiliar de formatação
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

export default function ContratoList({ 
    contratos, 
    sortConfig, 
    requestSort, 
    onUpdate, 
    basePath = "/contratos", 
    organizacaoId,
    onDelete // <--- 1. RECEBENDO A FUNÇÃO MÁGICA DA LIXEIRA
}) {
    const router = useRouter();
    const supabase = createClient();
    const [editingStatusId, setEditingStatusId] = useState(null);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, newStatus }) => {
            const result = await updateContratoStatus(id, newStatus);
            if (result.error) throw new Error(result.error);
            return result;
        },
        onSuccess: (_, variables) => {
            toast.success(`Status atualizado para "${variables.newStatus}"`);
            if (variables.newStatus === 'Assinado') {
                toast.info("Verificando automações de produto...", { duration: 2000 });
            }
            setEditingStatusId(null);
            if (onUpdate) onUpdate();
            router.refresh(); 
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleStatusChange = (id, newStatus) => {
        updateStatusMutation.mutate({ id, newStatus });
    };

    const handleDelete = async (e, contrato) => {
        e.stopPropagation();

        // --- 2. VERIFICAÇÃO PRIORITÁRIA ---
        // Se a página passou uma função de deletar (como a do Corretor), usa ela!
        if (onDelete) {
            onDelete(contrato.id);
            return;
        }

        // --- 3. FALLBACK DE SEGURANÇA (Se não tiver função, faz Soft Delete padrão) ---
        // Antes era .delete(), agora é .update() para lixeira
        if (confirm('Tem certeza que deseja excluir este contrato?')) {
            const { error } = await supabase
                .from('contratos')
                .update({ lixeira: true }) // <--- AGORA É LIXEIRA, NÃO DELETE
                .eq('id', contrato.id);
                
            if (error) toast.error("Erro ao excluir");
            else {
                toast.success("Contrato movido para a lixeira");
                if(onUpdate) onUpdate();
                router.refresh();
            }
        }
    };

    const handleDuplicate = async (e, contrato) => {
        e.stopPropagation();
        const { id, created_at, ...dados } = contrato;
        const novoContrato = {
            ...dados,
            status_contrato: 'Rascunho',
            numero_contrato: null, 
            data_venda: new Date().toISOString().split('T')[0],
            lixeira: false // <--- Garante que a cópia não nasce no lixo
        };
        
        const { error } = await supabase.from('contratos').insert(novoContrato);
        if (error) toast.error("Erro ao duplicar");
        else {
            toast.success("Contrato duplicado como Rascunho");
            if(onUpdate) onUpdate();
            router.refresh();
        }
    };

    const statusColors = {
        'Rascunho': 'bg-gray-100 text-gray-800',
        'Em negociação': 'bg-blue-100 text-blue-800',
        'Em assinatura': 'bg-yellow-100 text-yellow-800',
        'Assinado': 'bg-green-100 text-green-800',
        'Cancelado': 'bg-red-100 text-red-800',
    };

    const SortIcon = ({ column }) => {
        if (sortConfig?.key !== column) return <FontAwesomeIcon icon={faSort} className="text-gray-300 ml-1" />;
        return <FontAwesomeIcon icon={sortConfig.direction === 'ascending' ? faSortUp : faSortDown} className="text-blue-500 ml-1" />;
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th onClick={() => requestSort('numero_contrato')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Nº <SortIcon column="numero_contrato"/></th>
                            <th onClick={() => requestSort('tipo_documento')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Tipo <SortIcon column="tipo_documento"/></th>
                            <th onClick={() => requestSort('contato_nome')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Cliente <SortIcon column="contato_nome"/></th>
                            <th onClick={() => requestSort('empreendimento_nome')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Empreendimento <SortIcon column="empreendimento_nome"/></th>
                            <th onClick={() => requestSort('status_contrato')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Status <SortIcon column="status_contrato"/></th>
                            <th onClick={() => requestSort('data_venda')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Data <SortIcon column="data_venda"/></th>
                            <th onClick={() => requestSort('valor_final_venda')} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Valor <SortIcon column="valor_final_venda"/></th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {contratos && contratos.length > 0 ? contratos.map((contrato) => (
                            <tr key={contrato.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`${basePath}/${contrato.id}`)}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{contrato.numero_contrato || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{contrato.tipo_documento || 'Contrato'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    <div className="font-medium">{contrato.contato?.nome || contrato.contato?.razao_social || 'Sem Cliente'}</div>
                                    <div className="text-xs text-gray-500">{contrato.contato?.cpf || contrato.contato?.cnpj}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {contrato.empreendimento?.nome}
                                    {contrato.contrato_produtos?.[0]?.produtos_empreendimento?.unidade && (
                                        <span className="ml-1 text-xs bg-gray-100 px-1 rounded">
                                            Unid. {contrato.contrato_produtos[0].produtos_empreendimento.unidade}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    {editingStatusId === contrato.id ? (
                                        <select 
                                            autoFocus
                                            className="text-sm border rounded p-1 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            defaultValue={contrato.status_contrato}
                                            onChange={(e) => handleStatusChange(contrato.id, e.target.value)}
                                            onBlur={() => setEditingStatusId(null)}
                                        >
                                            {Object.keys(statusColors).map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span 
                                            onClick={() => setEditingStatusId(contrato.id)}
                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 ${statusColors[contrato.status_contrato] || 'bg-gray-100 text-gray-800'}`}
                                        >
                                            {contrato.status_contrato}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(contrato.data_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(contrato.valor_final_venda)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-3">
                                        <button onClick={() => router.push(`${basePath}/${contrato.id}`)} className="text-blue-600 hover:text-blue-900" title="Ver Detalhes">
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
                                        <button onClick={(e) => handleDuplicate(e, contrato)} className="text-gray-400 hover:text-gray-600" title="Duplicar">
                                            <FontAwesomeIcon icon={faCopy} />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, contrato)} className="text-red-400 hover:text-red-600" title="Excluir">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                                    Nenhum contrato encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
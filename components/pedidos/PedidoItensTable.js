// components/pedidos/PedidoItensTable.js
"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faExternalLinkAlt, faExclamationTriangle, faCheckCircle, faClock } from '@fortawesome/free-solid-svg-icons';

export default function PedidoItensTable({ pedidos, onCardClick }) {
    const [sortConfig, setSortConfig] = useState({ key: 'data_solicitacao', direction: 'descending' });

    // 1. Achatar a estrutura: Transforma Lista de Pedidos -> Lista de Itens com dados do pai
    const allItems = useMemo(() => {
        if (!pedidos) return [];
        return pedidos.flatMap(pedido => {
            if (!pedido.itens) return [];
            return pedido.itens.map(item => ({
                ...item,
                pedido_id: pedido.id,
                pedido_titulo: pedido.titulo,
                pedido_status: pedido.status,
                data_solicitacao: pedido.data_solicitacao,
                data_entrega_prevista: pedido.data_entrega_prevista,
                solicitante_nome: pedido.solicitante?.nome,
                empreendimento_nome: pedido.empreendimentos?.nome,
                pedido_original: pedido
            }));
        });
    }, [pedidos]);

    // 2. Lógica de Ordenação
    const sortedItems = useMemo(() => {
        let sortableItems = [...allItems];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (valA && typeof valA === 'string') valA = valA.toLowerCase();
                if (valB && typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [allItems, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name) => {
        if (sortConfig.key !== name) return <FontAwesomeIcon icon={faSort} className="text-gray-300" />;
        if (sortConfig.direction === 'ascending') return <FontAwesomeIcon icon={faSortUp} className="text-blue-600" />;
        return <FontAwesomeIcon icon={faSortDown} className="text-blue-600" />;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Solicitação': 'bg-gray-100 text-gray-700',
            'Em Cotação': 'bg-yellow-100 text-yellow-800',
            'Entregue': 'bg-green-100 text-green-800',
            'Cancelado': 'bg-red-100 text-red-800',
            'Realizado': 'bg-indigo-100 text-indigo-800',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
                {status}
            </span>
        );
    };

    if (allItems.length === 0) {
        return <div className="text-center py-10 text-gray-500">Nenhum material encontrado nos pedidos listados.</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
                {/* =================================================================================
                  CORREÇÃO DA LARGURA DA TABELA
                  O porquê: Adicionamos 'table-fixed' para forçar a tabela a obedecer
                  as larguras definidas nas colunas (<th>).
                  =================================================================================
                */}
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* =================================================================================
                              CORREÇÃO DA LARGURA DA COLUNA
                              O porquê: Definimos a largura da coluna de item para 33.3% (w-1/3)
                              para impedir que ela se expanda indefinidamente.
                              =================================================================================
                            */}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-1/3" onClick={() => requestSort('descricao_item')}>
                                Item / Material {getSortIcon('descricao_item')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('fornecedor')}>
                                Fornecedor {getSortIcon('fornecedor')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('quantidade_solicitada')}>
                                Qtd. {getSortIcon('quantidade_solicitada')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('pedido_status')}>
                                Status Pedido {getSortIcon('pedido_status')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('data_solicitacao')}>
                                Data Pedido {getSortIcon('data_solicitacao')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('data_entrega_prevista')}>
                                Entrega Prevista {getSortIcon('data_entrega_prevista')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedItems.map((item) => (
                            <tr key={`${item.id}-${item.pedido_id}`} className="hover:bg-blue-50 transition-colors group">
                                {/* =================================================================================
                                  CORREÇÃO DE QUEBRA DE TEXTO
                                  O porquê: Removemos 'whitespace-nowrap' do <td> e adicionamos
                                  'whitespace-normal' e 'break-words' no <div> interno para
                                  forçar a quebra de linha. 'align-top' garante o alinhamento.
                                  =================================================================================
                                */}
                                <td className="px-6 py-4 align-top">
                                    <div className="text-sm font-medium text-gray-900 whitespace-normal break-words">
                                        {item.descricao_item}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Pedido #{item.pedido_id} • {item.empreendimento_nome}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="text-sm text-gray-700">
                                        {item.fornecedor?.nome_fantasia || item.fornecedor?.razao_social || <span className="text-gray-400 italic">-</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center align-top">
                                    <div className="text-sm text-gray-900 font-semibold">{item.quantidade_solicitada} <span className="text-xs font-normal text-gray-500">{item.unidade_medida}</span></div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    {getStatusBadge(item.pedido_status)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                    {formatDate(item.data_solicitacao)}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                    <div className={`flex items-center gap-1 ${!item.data_entrega_prevista ? 'text-gray-400' : 'text-gray-700'}`}>
                                        <FontAwesomeIcon icon={faClock} className="text-xs opacity-50" />
                                        {formatDate(item.data_entrega_prevista)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-medium align-top">
                                    <button 
                                        onClick={() => onCardClick(item.pedido_original)}
                                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded border border-blue-200 transition-colors flex items-center gap-1 ml-auto"
                                    >
                                        <FontAwesomeIcon icon={faExternalLinkAlt} /> Ver Pedido
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                <span>Total de itens listados: {sortedItems.length}</span>
                <span>Ordenado por: {sortConfig.key}</span>
            </div>
        </div>
    );
}
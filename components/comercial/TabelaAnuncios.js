// components/comercial/TabelaAnuncios.js

"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

// Componente para o status (sem alterações)
const StatusBadge = ({ status }) => {
    const statusInfo = useMemo(() => {
        switch (status) {
            case 'ACTIVE': return { text: 'Ativo', color: 'bg-green-100 text-green-800' };
            case 'PAUSED': return { text: 'Pausado', color: 'bg-yellow-100 text-yellow-800' };
            case 'ARCHIVED': return { text: 'Arquivado', color: 'bg-gray-100 text-gray-800' };
            case 'DISAPPROVED': return { text: 'Reprovado', color: 'bg-red-100 text-red-800' };
            case 'CAMPAIGN_PAUSED': return { text: 'Campanha Pausada', color: 'bg-yellow-100 text-yellow-800' };
            case 'ADSET_PAUSED': return { text: 'Conjunto Pausado', color: 'bg-yellow-100 text-yellow-800' };
            case 'DELETED': return { text: 'Excluído', color: 'bg-red-100 text-red-800' };
            default: return { text: status, color: 'bg-blue-100 text-blue-800' };
        }
    }, [status]);

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
        </span>
    );
};

// =================================================================================
// NOVO COMPONENTE: FrequenciaBadge
// O PORQUÊ: Criamos um componente específico para a frequência para encapsular a lógica
// de cores que você pediu. Ele recebe o valor da frequência, formata com duas casas
// decimais e aplica a cor correta (verde, amarelo ou vermelho).
// =================================================================================
const FrequenciaBadge = ({ frequencia }) => {
    const valor = parseFloat(frequencia);
    let colorClass = '';

    if (valor > 2) {
        colorClass = 'bg-green-100 text-green-800'; // Maior que 2: Verde
    } else if (valor < 2) {
        colorClass = 'bg-red-100 text-red-800';     // Menor que 2: Vermelho
    } else {
        colorClass = 'bg-yellow-100 text-yellow-800'; // Igual a 2: Amarelo
    }

    return (
        <span className={`px-2 py-1 text-sm font-semibold rounded-full ${colorClass}`}>
            {valor.toFixed(2)}
        </span>
    );
};


// Funções de formatação (sem alterações)
const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'Contínuo';
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

const formatNumber = (value) => {
    return parseInt(value).toLocaleString('pt-BR');
}


export default function TabelaAnuncios({ data, filters }) {
    const [sortConfig, setSortConfig] = useState({ key: 'spend', direction: 'descending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredData = useMemo(() => {
        if (!data) return [];
        let filteredData = [...data];

        // Filtros (sem alterações)
        const searchTerm = filters.searchTerm.toLowerCase();
        if (searchTerm) {
            filteredData = filteredData.filter(ad =>
                ad.name.toLowerCase().includes(searchTerm) ||
                (ad.campaign_name && ad.campaign_name.toLowerCase().includes(searchTerm)) ||
                (ad.adset_name && ad.adset_name.toLowerCase().includes(searchTerm))
            );
        }
        if (filters.campaignIds && filters.campaignIds.length > 0) {
            filteredData = filteredData.filter(ad => filters.campaignIds.includes(ad.campaign_id));
        }
        if (filters.adsetIds && filters.adsetIds.length > 0) {
            filteredData = filteredData.filter(ad => filters.adsetIds.includes(ad.adset_id));
        }

        // =================================================================================
        // ALTERADO: Adicionamos a propriedade 'frequencia' a cada anúncio.
        // O PORQUÊ: Para que possamos usar esse valor tanto para exibição quanto para ordenação,
        // sem precisar recalculá-lo toda hora. Cuidamos do caso de divisão por zero.
        // =================================================================================
        let dataWithFrequencia = filteredData.map(ad => ({
            ...ad,
            frequencia: ad.reach > 0 ? (ad.impressions / ad.reach) : 0
        }));

        // Lógica de ordenação
        if (sortConfig.key) {
            dataWithFrequencia.sort((a, b) => { // Alterado para dataWithFrequencia
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                
                let comparison = 0;
                // ALTERADO: Adicionamos 'frequencia' na lista de chaves numéricas para ordenação
                if (['spend', 'leads', 'cost_per_lead', 'impressions', 'clicks', 'reach', 'frequencia'].includes(sortConfig.key)) {
                    comparison = parseFloat(valA) - parseFloat(valB);
                } 
                else if (['end_time', 'created_time'].includes(sortConfig.key)) {
                    const dateA = valA ? new Date(valA).getTime() : 0;
                    const dateB = valB ? new Date(valB).getTime() : 0;
                    comparison = dateA - dateB;
                } 
                else {
                    comparison = String(valA).localeCompare(String(valB));
                }
                
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        
        return dataWithFrequencia; // Alterado para dataWithFrequencia
    }, [data, filters, sortConfig]);

    const SortableHeader = ({ label, sortKey, className = '' }) => {
        const isActive = sortConfig.key === sortKey;
        const icon = isActive ? (sortConfig.direction === 'ascending' ? faSortUp : faSortDown) : faSort;
        return (
            <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${className}`} onClick={() => requestSort(sortKey)}>
                <div className="flex items-center gap-2">
                    {label}
                    <FontAwesomeIcon icon={icon} className={isActive ? 'text-gray-800' : 'text-gray-400'} />
                </div>
            </th>
        );
    };

    if (sortedAndFilteredData.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-600 font-semibold">Nenhum anúncio encontrado.</p>
                <p className="text-gray-500 text-sm">Tente ajustar os filtros ou aguarde novos dados.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criativo</th>
                        <SortableHeader label="Anúncio" sortKey="name" />
                        <SortableHeader label="Campanha" sortKey="campaign_name" />
                        <SortableHeader label="Status" sortKey="status" />
                        <SortableHeader label="Valor Gasto" sortKey="spend" />
                        <SortableHeader label="Alcance" sortKey="reach" />
                        <SortableHeader label="Impressões" sortKey="impressions" />
                        {/* NOVO: Adicionamos o cabeçalho para a coluna de Frequência. */}
                        <SortableHeader label="Frequência" sortKey="frequencia" />
                        <SortableHeader label="Leads" sortKey="leads" />
                        <SortableHeader label="Custo p/ Lead" sortKey="cost_per_lead" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {sortedAndFilteredData.map((ad) => (
                        <tr key={ad.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                                {ad.thumbnail_url ? (
                                    <Image src={ad.thumbnail_url} alt={`Criativo de ${ad.name}`} width={80} height={80} className="rounded object-cover" unoptimized />
                                ) : (
                                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                                        <FontAwesomeIcon icon={faImage} className="text-gray-400" />
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-4 align-top">
                                <div className="text-sm font-semibold text-gray-900">{ad.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{ad.adset_name}</div>
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-gray-700">
                                {ad.campaign_name}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                <StatusBadge status={ad.status} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatCurrency(ad.spend)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatNumber(ad.reach)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatNumber(ad.impressions)}</td>
                            {/* NOVO: Adicionamos a célula que renderiza o nosso novo componente FrequenciaBadge. */}
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                <FrequenciaBadge frequencia={ad.frequencia} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-bold align-top">{ad.leads}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{ad.cost_per_lead > 0 ? formatCurrency(ad.cost_per_lead) : 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
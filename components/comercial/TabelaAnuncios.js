// components/comercial/TabelaAnuncios.js

"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

// Um pequeno componente auxiliar para mostrar o status com cores
const StatusBadge = ({ status }) => {
    const statusInfo = useMemo(() => {
        switch (status) {
            case 'ACTIVE':
                return { text: 'Ativo', color: 'bg-green-100 text-green-800' };
            case 'PAUSED':
                return { text: 'Pausado', color: 'bg-yellow-100 text-yellow-800' };
            case 'ARCHIVED':
                return { text: 'Arquivado', color: 'bg-gray-100 text-gray-800' };
            case 'DISAPPROVED':
                return { text: 'Reprovado', color: 'bg-red-100 text-red-800' };
            case 'CAMPAIGN_PAUSED':
                return { text: 'Campanha Pausada', color: 'bg-yellow-100 text-yellow-800' };
            case 'ADSET_PAUSED':
                 return { text: 'Conjunto Pausado', color: 'bg-yellow-100 text-yellow-800' };
            case 'DELETED':
                return { text: 'Excluído', color: 'bg-red-100 text-red-800' };
            default:
                return { text: status, color: 'bg-blue-100 text-blue-800' };
        }
    }, [status]);

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
        </span>
    );
};

// Função para formatar moeda (Reais)
const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
};

export default function TabelaAnuncios({ data, filters }) {
    // Usamos useMemo para filtrar os dados de forma eficiente.
    // O filtro de status já foi feito na API, aqui só filtramos pela busca de texto.
    const filteredData = useMemo(() => {
        if (!data) return [];
        const searchTerm = filters.searchTerm.toLowerCase();

        if (!searchTerm) return data;

        return data.filter(ad =>
            ad.name.toLowerCase().includes(searchTerm) ||
            ad.campaign_name.toLowerCase().includes(searchTerm)
        );
    }, [data, filters.searchTerm]);

    if (filteredData.length === 0) {
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anúncio / Campanha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Gasto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressões</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliques</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredData.map((ad) => (
                        <tr key={ad.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                                {ad.thumbnail_url ? (
                                    <Image
                                        src={ad.thumbnail_url}
                                        alt={`Criativo de ${ad.name}`}
                                        width={80}
                                        height={80}
                                        className="rounded object-cover"
                                        unoptimized // Necessário para URLs externas do Facebook
                                    />
                                ) : (
                                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                                        <FontAwesomeIcon icon={faImage} className="text-gray-400" />
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-4 align-top">
                                <div className="text-sm font-semibold text-gray-900">{ad.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{ad.campaign_name}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                <StatusBadge status={ad.status} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatCurrency(ad.spend)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{parseInt(ad.impressions).toLocaleString('pt-BR')}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{parseInt(ad.clicks).toLocaleString('pt-BR')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
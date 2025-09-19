// components/comercial/TabelaAnuncios.js

"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

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

// Função para formatar moeda (sem alterações)
const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função para formatar a data
const formatDate = (dateString) => {
    if (!dateString) return 'Contínuo';
    // A data da Meta já vem com fuso horário, então 'new Date()' é seguro aqui.
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

export default function TabelaAnuncios({ data, filters }) {
    const filteredData = useMemo(() => {
        if (!data) return [];
        const searchTerm = filters.searchTerm.toLowerCase();
        if (!searchTerm) return data;
        return data.filter(ad =>
            ad.name.toLowerCase().includes(searchTerm) ||
            (ad.campaign_name && ad.campaign_name.toLowerCase().includes(searchTerm))
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
                    {/* ================================================================================= */}
                    {/* MUDANÇA AQUI: Adicionando os novos cabeçalhos da tabela ✨ */}
                    {/* ================================================================================= */}
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criativo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anúncio / Campanha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Término</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Gasto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo p/ Lead</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredData.map((ad) => (
                        <tr key={ad.id} className="hover:bg-gray-50">
                            {/* Criativo (sem alteração) */}
                            <td className="px-4 py-4 whitespace-nowrap">
                                {ad.thumbnail_url ? (
                                    <Image src={ad.thumbnail_url} alt={`Criativo de ${ad.name}`} width={80} height={80} className="rounded object-cover" unoptimized />
                                ) : (
                                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                                        <FontAwesomeIcon icon={faImage} className="text-gray-400" />
                                    </div>
                                )}
                            </td>
                            {/* Anúncio / Campanha (sem alteração) */}
                            <td className="px-4 py-4 align-top">
                                <div className="text-sm font-semibold text-gray-900">{ad.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{ad.campaign_name}</div>
                            </td>
                            {/* Status (sem alteração) */}
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                <StatusBadge status={ad.status} />
                            </td>
                            {/* ================================================================================= */}
                            {/* MUDANÇA AQUI: Adicionando as novas células com os dados ✨ */}
                            {/* ================================================================================= */}
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatDate(ad.end_time)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatCurrency(ad.spend)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-bold align-top">{ad.leads}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{ad.cost_per_lead > 0 ? formatCurrency(ad.cost_per_lead) : 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
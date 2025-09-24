// components/comercial/TabelaAnuncios.js

"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faSort, faSortUp, faSortDown, faSpinner, faPowerOff, faBan } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Componentes internos (StatusBadge, FrequenciaBadge) não precisam de alteração.
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
            default: return { text: status || 'Indefinido', color: 'bg-blue-100 text-blue-800' };
        }
    }, [status]);

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
        </span>
    );
};

const FrequenciaBadge = ({ frequencia }) => {
    const valor = parseFloat(frequencia);
    if (isNaN(valor)) return <span className="px-2 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">N/A</span>;

    let colorClass = 'bg-yellow-100 text-yellow-800';
    if (valor > 2) colorClass = 'bg-green-100 text-green-800';
    else if (valor < 1.5) colorClass = 'bg-red-100 text-red-800';
    
    return (
        <span className={`px-2 py-1 text-sm font-semibold rounded-full ${colorClass}`}>
            {valor.toFixed(2)}
        </span>
    );
};

const StatusToggleButton = ({ ad, onUpdate, isUpdating }) => {
    const isControllable = ['ACTIVE', 'PAUSED'].includes(ad.status);

    if (isUpdating) {
        return <div className="flex justify-center items-center w-10 h-10"><FontAwesomeIcon icon={faSpinner} spin /></div>;
    }

    if (!isControllable) {
        return (
             <div className="flex justify-center items-center w-10 h-10 rounded-md bg-gray-100 text-gray-400" title="Este status não pode ser alterado daqui">
                <FontAwesomeIcon icon={faBan} />
            </div>
        );
    }
    
    const isActive = ad.status === 'ACTIVE';
    const newStatus = isActive ? 'PAUSED' : 'ACTIVE';
    const buttonClass = isActive ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800';
    const title = isActive ? 'Clique para Pausar' : 'Clique para Ativar';

    return (
        <button
            onClick={() => onUpdate({ adId: ad.id, newStatus })}
            className={`flex justify-center items-center w-10 h-10 rounded-md transition-colors ${buttonClass}`}
            title={title}
        >
            <FontAwesomeIcon icon={faPowerOff} />
        </button>
    );
};

const formatCurrency = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 'R$ 0,00' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
const formatNumber = (value) => {
    const num = parseInt(value, 10);
    return isNaN(num) ? '0' : num.toLocaleString('pt-BR');
}

export default function TabelaAnuncios({ data }) {
    const queryClient = useQueryClient();
    const [updatingAdId, setUpdatingAdId] = useState(null);

    // O PORQUÊ DA MUDANÇA:
    // Esta é a atualização final e mais importante do componente.
    // 1. mutationFn: Agora chama a nossa nova e robusta rota '/api/meta/anuncios/update-status'.
    // 2. onSuccess: Após o sucesso, ela invalida a query `['localAds']`. Isso avisa para
    //    a página principal que os dados locais estão desatualizados e precisam ser
    //    buscados novamente, garantindo que a tabela mostre o status mais recente.
    const updateAdStatusMutation = useMutation({
        mutationFn: async ({ adId, newStatus }) => {
            const response = await fetch('/api/meta/anuncios/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adId, newStatus }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao atualizar status.');
            }
            return response.json();
        },
        onMutate: ({ adId }) => {
            setUpdatingAdId(adId);
        },
        onSuccess: () => {
            toast.success('Status do anúncio atualizado com sucesso!');
            // Invalida a query de anúncios locais para forçar a recarga
            queryClient.invalidateQueries({ queryKey: ['localAds'] });
        },
        onError: (error) => {
            toast.error(`Erro ao atualizar: ${error.message}`);
        },
        onSettled: () => {
            setUpdatingAdId(null);
        },
    });
    
    // O PORQUÊ DA MUDANÇA:
    // Removemos toda a lógica de ordenação e filtro daqui. Por quê?
    // Porque nossa API local (`/api/meta/anuncios/local`) já faz todo esse
    // trabalho pesado no servidor. O componente da tabela agora tem uma única
    // e simples tarefa: exibir os dados que recebe. Fica mais limpo e performático.
    const anuncios = data || [];

    if (anuncios.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-600 font-semibold">Nenhum anúncio encontrado.</p>
                <p className="text-gray-500 text-sm">Tente sincronizar com a Meta ou ajustar os filtros.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criativo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anúncio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campanha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Gasto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alcance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressões</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequência</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo p/ Lead</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {anuncios.map((ad) => (
                        <tr key={ad.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap align-top">
                                <StatusToggleButton ad={ad} onUpdate={updateAdStatusMutation.mutate} isUpdating={updatingAdId === ad.id} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                {ad.thumbnail_url ? <Image src={ad.thumbnail_url} alt={`Criativo de ${ad.name}`} width={80} height={80} className="rounded object-cover" unoptimized /> : <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center"><FontAwesomeIcon icon={faImage} className="text-gray-400" /></div>}
                            </td>
                            <td className="px-4 py-4 align-top">
                                <div className="text-sm font-semibold text-gray-900">{ad.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{ad.adset_name}</div>
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-gray-700">{ad.campaign_name}</td>
                            <td className="px-4 py-4 whitespace-nowrap align-top"><StatusBadge status={ad.status} /></td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatCurrency(ad.spend)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatNumber(ad.reach)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{formatNumber(ad.impressions)}</td>
                            <td className="px-4 py-4 whitespace-nowrap align-top"><FrequenciaBadge frequencia={ad.frequencia} /></td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-bold align-top">{formatNumber(ad.leads)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 align-top">{ad.cost_per_lead > 0 ? formatCurrency(ad.cost_per_lead) : 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
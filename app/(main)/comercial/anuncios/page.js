// app/(main)/comercial/anuncios/page.js
"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faBullhorn, faChartLine, faDollarSign, faUsers, faMousePointer, faHandPointUp, faCoins } from '@fortawesome/free-solid-svg-icons';
import { format, subDays } from 'date-fns';
import KpiCard from '@/components/KpiCard';

// =================================================================================
// O PORQUÊ DESTA ATUALIZAÇÃO:
// Estamos trocando a grade de anúncios por uma estrutura muito mais poderosa.
// Esta nova versão introduz:
// 1. Seletores de Conta e Período: Para focar a análise onde importa.
// 2. Tabela de Campanhas: Uma visão organizada e comparativa da performance.
// 3. Métricas Chave (KPIs): Agora calculamos e exibimos o Custo por Clique (CPC)
//    e, mais importante, o Custo por Lead (CPL), conectando o gasto com resultados reais.
// 4. Componentização Lógica: Separamos a lógica de busca e exibição em componentes
//    e hooks `useQuery`, tornando o código mais limpo e escalável para os próximos
//    níveis (Conjuntos de Anúncios e Anúncios).
// =================================================================================

// Hook para buscar dados da nossa nova API
const fetchMetaDados = async (params) => {
    const urlParams = new URLSearchParams(params);
    const response = await fetch(`/api/meta/dados?${urlParams.toString()}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao buscar dados da Meta.');
    }
    return response.json();
};

// Componente para a Tabela de Campanhas
const CampaignsTable = ({ data, isLoading, error }) => {
    if (isLoading) return (
        <div className="text-center py-10">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
            <p className="mt-2 text-gray-600">Buscando campanhas...</p>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">
            <p><span className="font-semibold">Erro ao carregar campanhas:</span> {error.message}</p>
        </div>
    );

    if (!data || data.length === 0) return (
        <p className="text-center py-10 text-gray-500">Nenhuma campanha encontrada para a conta e período selecionados.</p>
    );

    const formatCurrency = (value) => `R$ ${value.replace('.', ',')}`;

    return (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campanha</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Gasto</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressões</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliques</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPC</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPL</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map(c => {
                        const gasto = parseFloat(c.gasto);
                        const cliques = c.cliques;
                        const leads = c.leads;
                        const cpc = cliques > 0 ? (gasto / cliques).toFixed(2) : '0.00';
                        const cpl = leads > 0 ? (gasto / leads).toFixed(2) : '0.00';
                        
                        return (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{c.nome}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatCurrency(c.gasto)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{c.impressoes.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{c.cliques.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{c.leads}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatCurrency(cpc)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(cpl)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


export default function AnunciosPage() {
    const today = new Date();
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [dateRange, setDateRange] = useState({
        since: format(subDays(today, 7), 'yyyy-MM-dd'),
        until: format(today, 'yyyy-MM-dd'),
    });

    const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
        queryKey: ['metaAdAccounts'],
        queryFn: () => fetchMetaDados({ tipo: 'contas' }),
    });

    const { data: campaigns = [], error: campaignsError, isLoading: isLoadingCampaigns } = useQuery({
        queryKey: ['metaCampaigns', selectedAccountId, dateRange],
        queryFn: () => fetchMetaDados({ tipo: 'campanhas', contaId: selectedAccountId, ...dateRange }),
        enabled: !!selectedAccountId, // Só executa a busca se uma conta for selecionada
    });
    
    // Calcula os KPIs totais usando os dados das campanhas
    const kpiData = useMemo(() => {
        if (!campaigns || campaigns.length === 0) {
            return { totalSpend: 0, totalLeads: 0, totalClicks: 0, totalImpressions: 0 };
        }
        return campaigns.reduce((acc, c) => {
            acc.totalSpend += parseFloat(c.gasto);
            acc.totalLeads += c.leads;
            acc.totalClicks += c.cliques;
            acc.totalImpressions += c.impressoes;
            return acc;
        }, { totalSpend: 0, totalLeads: 0, totalClicks: 0, totalImpressions: 0 });
    }, [campaigns]);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard de Performance de Anúncios</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor Total Gasto" value={`R$ ${kpiData.totalSpend.toFixed(2).replace('.', ',')}`} icon={faDollarSign} color="green" />
                <KpiCard title="Total de Leads" value={kpiData.totalLeads.toLocaleString('pt-BR')} icon={faUsers} color="blue" />
                <KpiCard title="Total de Cliques" value={kpiData.totalClicks.toLocaleString('pt-BR')} icon={faMousePointer} color="purple" />
                <KpiCard title="Custo por Lead (CPL)" value={kpiData.totalLeads > 0 ? `R$ ${(kpiData.totalSpend / kpiData.totalLeads).toFixed(2).replace('.', ',')}` : 'R$ 0,00'} icon={faCoins} color="yellow" />
            </div>

            {/* Filtros */}
            <div className="p-4 bg-white rounded-lg shadow space-y-4 md:space-y-0 md:flex md:items-end md:justify-between">
                <div className="flex-1 md:mr-4">
                    <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mb-1">Conta de Anúncios</label>
                    <select
                        id="account-select"
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        disabled={isLoadingAccounts || accounts.length === 0}
                    >
                        <option value="">{isLoadingAccounts ? 'Carregando contas...' : 'Selecione uma conta'}</option>
                        {accounts.map(account => (
                            <option key={account.id} value={account.id}>{account.name} ({account.id})</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end gap-4">
                    <div>
                        <label htmlFor="since" className="block text-sm font-medium text-gray-700 mb-1">De</label>
                        <input type="date" name="since" id="since" value={dateRange.since} onChange={handleDateChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label htmlFor="until" className="block text-sm font-medium text-gray-700 mb-1">Até</label>
                        <input type="date" name="until" id="until" value={dateRange.until} onChange={handleDateChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                </div>
            </div>

            {/* Tabela de Campanhas */}
            <div>
                <CampaignsTable data={campaigns} isLoading={isLoadingCampaigns} error={campaignsError} />
            </div>
        </div>
    );
}
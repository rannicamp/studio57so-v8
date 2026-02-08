// components/comercial/KpiAnuncios.js

"use client";

import { useMemo } from 'react';
import KpiCard from '@/components/shared/KpiCard';
import { faBullhorn, faChartLine, faCoins, faUsers } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// O PORQUÊ deste novo componente:
// Para manter a página de anúncios limpa e organizada, isolamos toda a lógica
// de cálculo e exibição dos KPIs aqui. Este componente recebe os dados brutos
// dos anúncios e os transforma nos 4 indicadores principais.
// Usamos `useMemo` para garantir que os cálculos só sejam refeitos quando os dados
// realmente mudarem, o que otimiza a performance.
// Reutilizamos o componente `KpiCard` para manter a consistência visual do sistema.
// =================================================================================

const KpiAnuncios = ({ data, isLoading }) => {
    const kpis = useMemo(() => {
        if (!data || data.length === 0) {
            return {
                totalGasto: 0,
                totalLeads: 0,
                cpl: 0,
                anunciosAtivos: 0,
                gastoDiarioAtivos: 0,
            };
        }

        const anunciosAtivosArray = data.filter(ad => ad.status === 'ACTIVE');

        const totalGasto = data.reduce((sum, ad) => sum + parseFloat(ad.spend || 0), 0);
        const totalLeads = data.reduce((sum, ad) => sum + (ad.leads || 0), 0);
        const cpl = totalLeads > 0 ? totalGasto / totalLeads : 0;
        
        const anunciosAtivos = anunciosAtivosArray.length;
        const gastoDiarioAtivos = anunciosAtivosArray.reduce((sum, ad) => sum + parseFloat(ad.spend_today || 0), 0);

        return {
            totalGasto,
            totalLeads,
            cpl,
            anunciosAtivos,
            gastoDiarioAtivos,
        };
    }, [data]);

    if (isLoading) {
        // Mostra um estado de carregamento para os KPIs
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="bg-gray-200 h-28 rounded-lg animate-pulse"></div>
                ))}
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
                icon={faCoins}
                title="Total Gasto"
                value={`R$ ${kpis.totalGasto.toFixed(2).replace('.', ',')}`}
                tooltip="Soma do valor gasto em todos os anúncios exibidos, no período selecionado."
            />
            <KpiCard
                icon={faUsers}
                title="Total de Leads"
                value={kpis.totalLeads.toLocaleString('pt-BR')}
                tooltip="Soma de todos os leads gerados pelos anúncios exibidos, no período selecionado."
            />
            <KpiCard
                icon={faChartLine}
                title="Custo por Lead (CPL)"
                value={`R$ ${kpis.cpl.toFixed(2).replace('.', ',')}`}
                tooltip="Custo médio para adquirir um lead. (Total Gasto / Total de Leads)"
            />
            <KpiCard
                icon={faBullhorn}
                title="Anúncios Ativos / Gasto Hoje"
                value={`${kpis.anunciosAtivos} / R$ ${kpis.gastoDiarioAtivos.toFixed(2).replace('.', ',')}`}
                tooltip="Número de anúncios com status 'Ativo' e o valor total que eles gastaram hoje."
            />
        </div>
    );
};

export default KpiAnuncios;
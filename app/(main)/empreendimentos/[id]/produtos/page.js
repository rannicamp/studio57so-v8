"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import ProdutoList from '../../../../../components/ProdutoList';
import CondicoesPagamento from '../../../../../components/CondicoesPagamento';
import TabelaVenda from '../../../../../components/TabelaVenda';
import Accordion from '../../../../../components/Accordion';
import KpiCard from '../../../../../components/KpiCard'; // Importando o KpiCard
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faTags, faTag, faCheckCircle, faLockOpen, faBullseye } from '@fortawesome/free-solid-svg-icons';

export default function ProdutosPage() {
    const supabase = createClient();
    const params = useParams();
    const { id: empreendimentoId } = params;

    const [empreendimento, setEmpreendimento] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        
        const { data: empreendimentoData, error: empreendimentoError } = await supabase.from('empreendimentos').select('nome').eq('id', empreendimentoId).single();
        if (empreendimentoError) return notFound();
        setEmpreendimento(empreendimentoData);

        const { data: produtosData } = await supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).order('unidade');
        setProdutos(produtosData || []);
        
        const { data: configData } = await supabase.from('configuracoes_venda').select('*, parcelas_adicionais(*)').eq('empreendimento_id', empreendimentoId).maybeSingle();
        setConfig(configData || { empreendimento_id: empreendimentoId, parcelas_adicionais: [] });
        
        setLoading(false);
    }, [supabase, empreendimentoId]);

    useEffect(() => { if (empreendimentoId) fetchData(); }, [empreendimentoId, fetchData]);

    const kpiData = useMemo(() => {
        const totalUnidades = produtos.length;
        if (totalUnidades === 0) {
            return { vgvTotal: 'R$ 0,00', totalUnidades: 0, unidadesVendidas: 0, unidadesDisponiveis: 0, unidadesReservadas: 0, taxaVendas: '0.00%', ticketMedio: 'R$ 0,00' };
        }

        const vendidas = produtos.filter(p => p.status === 'Vendido');
        const reservadas = produtos.filter(p => p.status === 'Reservado');
        
        const vgvTotal = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0);
        const valorVendido = vendidas.reduce((acc, p) => acc + (parseFloat(p.valor_venda_calculado) || 0), 0);
        
        return {
            vgvTotal: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vgvTotal),
            totalUnidades,
            unidadesVendidas: vendidas.length,
            unidadesDisponiveis: totalUnidades - vendidas.length - reservadas.length,
            unidadesReservadas: reservadas.length,
            taxaVendas: `${((vendidas.length / totalUnidades) * 100).toFixed(2)}%`,
            ticketMedio: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorVendido / vendidas.length || 0),
        };
    }, [produtos]);

    if (loading || !empreendimento) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
    }

    return (
        <div className="space-y-6">
            <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empreendimentos
            </Link>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">
                    Comercialização de: <span className="text-blue-600">{empreendimento.nome}</span>
                </h1>
            </div>

            {/* Nova Seção de KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <KpiCard title="VGV Total" value={kpiData.vgvTotal} icon={faChartLine} color="blue" />
                <KpiCard title="Unidades Vendidas" value={`${kpiData.unidadesVendidas} / ${kpiData.totalUnidades}`} icon={faTag} color="green" />
                <KpiCard title="Unidades Reservadas" value={kpiData.unidadesReservadas} icon={faBullseye} color="yellow" />
                <KpiCard title="Taxa de Vendas" value={kpiData.taxaVendas} icon={faTags} color="purple" />
            </div>
            
            <Accordion title="1. Produtos e Preços" startOpen={true}>
                <ProdutoList 
                    initialProdutos={produtos} 
                    empreendimentoId={empreendimentoId} 
                    initialConfig={config}
                    onUpdate={fetchData} 
                />
            </Accordion>

            <Accordion title="2. Condições de Pagamento" startOpen={false}>
                <CondicoesPagamento
                    empreendimentoId={empreendimentoId}
                    initialConfig={config}
                    onUpdate={fetchData} 
                />
            </Accordion>
            
            <Accordion title="3. Tabela de Venda (Simulação)" startOpen={false}>
                <TabelaVenda 
                    produtos={produtos}
                    config={config}
                    parcelasAdicionais={config.parcelas_adicionais || []}
                />
            </Accordion>
        </div>
    );
}
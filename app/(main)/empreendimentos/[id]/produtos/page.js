// app/(main)/empreendimentos/[id]/produtos/page.js
"use client";

import { useMemo } from 'react';
import { createClient } from '../../../../../utils/supabase/client';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import ProdutoList from '@/components/produtos/ProdutoList';
import CondicoesPagamento from '../../../../../components/CondicoesPagamento';
import TabelaVenda from '../../../../../components/TabelaVenda';
import Accordion from '../../../../../components/Accordion';
import KpiCard from '@/components/shared/KpiCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faTags, faTag, faBullseye, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// FUNÇÃO DE BUSCA DE DADOS
// =================================================================================
const fetchComercializacaoData = async (supabase, empreendimentoId, organizacaoId) => {
    if (!empreendimentoId || !organizacaoId) return null;

    const [empreendimentoRes, produtosRes, configRes] = await Promise.all([
        supabase.from('empreendimentos').select('*').eq('id', empreendimentoId).eq('organizacao_id', organizacaoId).single(),
        supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).eq('organizacao_id', organizacaoId).order('unidade'),
        supabase.from('configuracoes_venda').select('*').eq('empreendimento_id', empreendimentoId).eq('organizacao_id', organizacaoId).maybeSingle()
    ]);

    if (empreendimentoRes.error) {
        if (empreendimentoRes.error.code === 'PGRST116') {
            throw new Error('Empreendimento não encontrado ou você não tem permissão para acessá-lo.');
        }
        throw new Error(`Erro ao buscar empreendimento: ${empreendimentoRes.error.message}`);
    }

    if (produtosRes.error) throw new Error(`Erro ao buscar produtos: ${produtosRes.error.message}`);
    if (configRes.error) throw new Error(`Erro ao buscar configurações: ${configRes.error.message}`);

    return {
        empreendimento: empreendimentoRes.data,
        produtos: produtosRes.data || [],
        config: configRes.data || { empreendimento_id: empreendimentoId, parcelas_adicionais: [] }
    };
};


export default function ProdutosPage() {
    // CORREÇÃO: Removido 'await' (Componente de Cliente)
    const supabase = createClient();
    const params = useParams();
    const { id: empreendimentoId } = params;
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data, isLoading: loading, isError, error, refetch } = useQuery({
        queryKey: ['comercializacaoData', empreendimentoId, organizacaoId],
        queryFn: () => fetchComercializacaoData(supabase, empreendimentoId, organizacaoId),
        enabled: !!empreendimentoId && !!organizacaoId,
        retry: false,
    });

    const { empreendimento, produtos = [], config } = data || {};

    if (isError && error.message.includes('Empreendimento não encontrado')) {
        notFound();
    }

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

    if (isError) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-600">Erro ao Carregar</h2>
                <p className="mt-2 text-red-700">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Link href="/empreendimentos" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-4">
                ← Voltar para Empreendimentos
            </Link>
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">
                    Comercialização de: <span className="text-blue-600">{empreendimento.nome}</span>
                </h1>
            </div>

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
                    onUpdate={refetch}
                />
            </Accordion>

            <Accordion title="2. Condições de Pagamento" startOpen={false}>
                <CondicoesPagamento
                    empreendimentoId={empreendimentoId}
                    initialConfig={config}
                    onUpdate={refetch}
                />
            </Accordion>

            <Accordion title="3. Tabela de Venda (Simulação)" startOpen={false}>
                <TabelaVenda
                    produtos={produtos}
                    config={config}
                    parcelasAdicionais={config.parcelas_adicionais || []}
                    empreendimento={empreendimento}
                />
            </Accordion>
        </div>
    );
}
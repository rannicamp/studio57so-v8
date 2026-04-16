"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBuilding, faCube, faChartPie } from '@fortawesome/free-solid-svg-icons';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

export default function RelatorioEmpreendimentosPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const [empreendimentoSelecionadoId, setEmpreendimentoSelecionadoId] = useState('ALL');

    // === 1. BUSCA PARALELA NO SUPABASE ===
    const { data: rawData, isLoading } = useQuery({
        queryKey: ['relatorio_empreendimentos_full', user?.organizacao_id],
        queryFn: async () => {
            if (!user?.organizacao_id) return null;

            const [empRes, prodRes, contRes, contProdRes] = await Promise.all([
                supabase.from('empreendimentos').select('id, nome, listado_para_venda').eq('organizacao_id', user.organizacao_id),
                supabase.from('produtos_empreendimento').select('id, empreendimento_id, unidade, tipo, area_m2, valor_venda_calculado, status').eq('organizacao_id', user.organizacao_id),
                supabase.from('contratos').select('id, empreendimento_id, produto_id, valor_final_venda, status_contrato').eq('organizacao_id', user.organizacao_id).eq('status_contrato', 'Assinado'),
                supabase.from('contrato_produtos').select('contrato_id, produto_id').eq('organizacao_id', user.organizacao_id)
            ]);

            return {
                empreendimentos: empRes.data || [],
                produtos: prodRes.data || [],
                contratos: contRes.data || [],
                contratoProdutos: contProdRes.data || []
            };
        },
        enabled: !!user?.organizacao_id
    });

    // === 2. CRIAÇÃO DOS INDICADORES E AGRUPAMENTOS ===
    const dataAgrupada = useMemo(() => {
        if (!rawData) return { empreendimentos: [], chartPizzaVGV: [], produtosFormatados: [] };

        const { empreendimentos, produtos, contratos } = rawData;

        let totalVGVGlobal = 0;
        const chartPizzaVGV = [];
        
        // Vamos varrer cada empreendimento listado
        const empProcessados = empreendimentos
        .filter(emp => emp.listado_para_venda)
        .map(emp => {
            // Produtos do empreendimento
            const produtosVinculados = produtos.filter(p => p.empreendimento_id === emp.id);
            
            // Contratos do empreendimento (ainda util para VGV de contratos reais)
            const contratosVinculados = contratos.filter(c => c.empreendimento_id === emp.id);

            // Um produto só compõe o Estoque Listado de VGV se ainda NÃO foi vendido.
            const valorEstoqueListado = produtosVinculados.reduce((sum, p) => {
                if (p.status !== 'Vendido' && p.status !== 'Permuta') {
                    return sum + (Number(p.valor_venda_calculado) || 0);
                }
                return sum;
            }, 0);

            // Calcula VGV Vendido (Contratos Assinados reias)
            const valorVendido = contratosVinculados
                .reduce((sum, c) => sum + (Number(c.valor_final_venda) || 0), 0);

            const vgvTotal = valorEstoqueListado + valorVendido;
            totalVGVGlobal += vgvTotal;

            // Alimenta os dados do Gráfico de Pizza se tiver VGV
            if (vgvTotal > 0) {
                chartPizzaVGV.push({ name: emp.nome, value: vgvTotal });
            }

            const areaTotalM2 = produtosVinculados.reduce((sum, p) => sum + (Number(p.area_m2) || 0), 0);
            const areaVendidaM2 = produtosVinculados.reduce((sum, p) => {
                const temContrato = !!rawData.contratoProdutos.find(cp => cp.produto_id === p.id);
                return (p.status === 'Vendido' || p.status === 'Permuta' || temContrato) ? sum + (Number(p.area_m2) || 0) : sum;
            }, 0);
            const areaEstoqueM2 = areaTotalM2 - areaVendidaM2;

            return {
                ...emp,
                produtos: produtosVinculados,
                estatisticas: {
                    valorDisponivel: valorEstoqueListado,
                    valorVendido,
                    vgvTotal,
                    qtdTotal: produtosVinculados.length,
                    qtdDisponivel: produtosVinculados.filter(p => p.status === 'Disponível').length,
                    qtdVendido: contratosVinculados.length,
                    areaTotalM2,
                    areaVendidaM2,
                    areaEstoqueM2
                }
            };
        }).sort((a, b) => b.estatisticas.vgvTotal - a.estatisticas.vgvTotal);

        // Prepara Lista Flat de Produtos para a Tabela Inferior (Mesclando preço contrato)
        let produtosFormatados = [];
        for (const emp of empProcessados) {
            for (const prod of emp.produtos) {
                // Checa se o produto está na tabela associativa de contrato_produtos
                const ligacao = rawData.contratoProdutos.find(cp => cp.produto_id === prod.id);
                // Se achou, busca o contrato
                const contratoDoProduto = ligacao ? contratos.find(c => c.id === ligacao.contrato_id) : null;

                const valorAtual = contratoDoProduto ? contratoDoProduto.valor_final_venda : prod.valor_venda_calculado;
                
                produtosFormatados.push({
                    ...prod,
                    nome_empreendimento: emp.nome,
                    is_vendido: !!contratoDoProduto,
                    valor_atual: Number(valorAtual) || 0,
                    preco_m2: (Number(valorAtual) || 0) / (Number(prod.area_m2) || 1)
                });
            }
        }

        // Filtra os produtos pela seleção global da tela
        if (empreendimentoSelecionadoId !== 'ALL') {
            produtosFormatados = produtosFormatados.filter(p => p.empreendimento_id === Number(empreendimentoSelecionadoId));
        }

        // Ordena por Empreendimento > Status > Valor
        produtosFormatados.sort((a, b) => {
            if (a.empreendimento_id !== b.empreendimento_id) return a.empreendimento_id - b.empreendimento_id;
            return b.valor_atual - a.valor_atual;
        });

        return { empreendimentos: empProcessados, chartPizzaVGV, produtosFormatados };
    }, [rawData, empreendimentoSelecionadoId]);

    // === 3. RENDERIZAÇÃO DA INTERFACE ===
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-blue-500" />
                <p>Levantando dados físicos e valores contratuais...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in p-2">
            
            {/* CABEÇALHO COM FILTRO */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><FontAwesomeIcon icon={faBuilding} /></span>
                        Panorama de Empreendimentos
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Análise de VGV (Valor Geral de Vendas), Metragem Quadrada e Estoque Produto a Produto.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="p-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 min-w-[200px]"
                        value={empreendimentoSelecionadoId}
                        onChange={(e) => setEmpreendimentoSelecionadoId(e.target.value)}
                    >
                        <option value="ALL">Todo o Portfólio (Todos)</option>
                        {dataAgrupada.empreendimentos.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* PRIMEIRA LINHA: Gráfico de VGV (Estilo RH) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* O GRÁFICO DE PIZZA SOLICITADO */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
                    <h3 className="text-sm font-bold text-gray-700 w-full text-center mb-4 uppercase tracking-wider flex items-center justify-center gap-2 border-b pb-2">
                        <FontAwesomeIcon icon={faChartPie} className="text-indigo-400" /> 
                        Distribuição do VGV Total
                    </h3>
                    <div className="flex-1 w-full h-[250px] mt-2">
                        {dataAgrupada.chartPizzaVGV.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={dataAgrupada.chartPizzaVGV} 
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={100} 
                                        paddingAngle={3} dataKey="value"
                                        labelLine={false}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                            if (percent < 0.05) return null; // Oculta % muito pequenos pra não encavalar
                                            const RADIAN = Math.PI / 180;
                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" className="drop-shadow-md">
                                                    {`${(percent * 100).toFixed(0)}%`}
                                                </text>
                                            );
                                        }}
                                    >
                                        {dataAgrupada.chartPizzaVGV.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                      formatter={(value) => [formatCurrency(value), 'VGV Possível']} 
                                    />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: '500' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 text-sm italic">
                                Sem empreendimentos c/ VGV listados.
                            </div>
                        )}
                    </div>
                </div>

                {/* PAINEL DE TOTAIS VGV */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {/* Se nenhum filtro aplicado, mostra totais gerais ou do especifico */}
                     <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-indigo-500 opacity-20">
                            <FontAwesomeIcon icon={faBuilding} className="text-8xl" />
                        </div>
                        <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2 z-10">VGV Total Consolidado</span>
                        <h3 className="text-4xl font-extrabold z-10">
                            {formatCurrency(
                                empreendimentoSelecionadoId === 'ALL' 
                                    ? dataAgrupada.chartPizzaVGV.reduce((s,i) => s + i.value, 0)
                                    : dataAgrupada.empreendimentos.find(e => e.id === Number(empreendimentoSelecionadoId))?.estatisticas.vgvTotal || 0
                            )}
                        </h3>
                    </div>

                    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-gray-50 opacity-80">
                            <FontAwesomeIcon icon={faCube} className="text-8xl" />
                        </div>
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 z-10">Estoque de Área (m² p/ Vender)</span>
                        <h3 className="text-4xl font-extrabold text-emerald-600 z-10">
                             {formatNumber(
                                empreendimentoSelecionadoId === 'ALL' 
                                    ? dataAgrupada.empreendimentos.reduce((s,e) => s + e.estatisticas.areaEstoqueM2, 0)
                                    : dataAgrupada.empreendimentos.find(e => e.id === Number(empreendimentoSelecionadoId))?.estatisticas.areaEstoqueM2 || 0
                            )} <span className="text-lg text-emerald-400 font-medium">m² líquidos</span>
                        </h3>
                        <p className="text-xs text-gray-400 mt-2 z-10 font-bold uppercase tracking-wider">
                            🚀 Já vendidos: {formatNumber(
                                empreendimentoSelecionadoId === 'ALL' 
                                    ? dataAgrupada.empreendimentos.reduce((s,e) => s + e.estatisticas.areaVendidaM2, 0)
                                    : dataAgrupada.empreendimentos.find(e => e.id === Number(empreendimentoSelecionadoId))?.estatisticas.areaVendidaM2 || 0
                            )} m²
                        </p>
                    </div>
                </div>
            </div>



        </div>
    );
}

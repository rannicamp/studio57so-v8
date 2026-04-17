"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faBuilding, faCube, faChartPie, 
    faMoneyBillWave, faFileSignature, faInfoCircle, faCheckCircle,
    faMap, faCity, faTachometerAlt
} from '@fortawesome/free-solid-svg-icons';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val || 0);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

// Estilo de Componente Exato Extraído do RHDashboard.js (Padrão Ouro de Diretoria)
const DashboardKpi = ({ title, value, icon, bgIcon, colorIcon, subtext, tooltip }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <div className="flex items-center gap-1 mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
        {tooltip && (
          <div className="relative flex items-center group z-20">
            <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300 hover:text-blue-500 cursor-help transition-colors text-xs" />
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-xl shadow-xl normal-case font-medium pointer-events-none">
              <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <h3 className="text-3xl font-extrabold text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgIcon} ${colorIcon}`}>
      <FontAwesomeIcon icon={icon} className="text-xl" />
    </div>
  </div>
);

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
                supabase.from('empreendimentos').select('id, nome, listado_para_venda, categoria').eq('organizacao_id', user.organizacao_id),
                supabase.from('produtos_empreendimento').select('id, empreendimento_id, unidade, tipo, area_m2, valor_venda_calculado, status').eq('organizacao_id', user.organizacao_id),
                supabase.from('contratos').select('id, empreendimento_id, produto_id, valor_final_venda, status_contrato, tipo_documento').eq('organizacao_id', user.organizacao_id).eq('status_contrato', 'Assinado'),
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

    // === 2. CRIAÇÃO DOS INDICADORES E AGRUPAMENTOS VGV ===
    const dataAgrupada = useMemo(() => {
        if (!rawData) return { empreendimentos: [], chartPizzaVGV: [], produtosFormatados: [], estatisticasGlobais: {} };

        const { empreendimentos, produtos, contratos } = rawData;

        let totalVGVGlobal = 0;
        let totalValoresVendidos = 0;
        let totalEstoqueListado = 0;
        let totalAreaTotalM2 = 0;
        let totalAreaVendidaM2 = 0;
        let totalAreaHorizontal = 0;
        let totalVgvHorizontal = 0;
        let totalAreaVertical = 0;
        let totalVgvVertical = 0;
        let totalQtd = 0;
        let totalQtdVendida = 0;
        
        const chartPizzaVGV = [];
        const chartPizzaM2Horizontal = [];
        const chartPizzaM2Vertical = [];
        
        // Separação de Cálculo e Auditoria Estrutural
        const empProcessados = empreendimentos
        .filter(emp => emp.listado_para_venda)
        .map(emp => {
            const produtosVinculados = produtos.filter(p => p.empreendimento_id === emp.id);
            const contratosVinculados = contratos.filter(c => c.empreendimento_id === emp.id);

            // Regra de Ouro Aplicada: Soma as unidades Disponíveis ou Reservadas que não possuam Contrato Assinado
            const valorEstoqueListado = produtosVinculados.reduce((sum, p) => {
                const ligacao = rawData.contratoProdutos.find(cp => cp.produto_id === p.id);
                const temContratoFirme = ligacao ? contratos.some(c => c.id === ligacao.contrato_id && c.tipo_documento === 'CONTRATO') : false;
                
                if ((p.status === 'Disponível' || p.status === 'Reservado' || p.status === 'Reservada') && !temContratoFirme) {
                    return sum + (Number(p.valor_venda_calculado) || 0);
                }
                return sum;
            }, 0);

            // Blindagem do que já é certo: Apenas Contratos (exclui termos de interesse)
            const valorVendido = contratosVinculados.reduce((sum, c) => c.tipo_documento === 'CONTRATO' ? sum + (Number(c.valor_final_venda) || 0) : sum, 0);

            const vgvTotal = valorEstoqueListado + valorVendido;

            totalVGVGlobal += vgvTotal;
            totalValoresVendidos += valorVendido;
            totalEstoqueListado += valorEstoqueListado;

            if (vgvTotal > 0) {
                chartPizzaVGV.push({ name: emp.nome, value: vgvTotal });
            }

            const areaTotalM2 = produtosVinculados.reduce((sum, p) => sum + (Number(p.area_m2) || 0), 0);
            if (areaTotalM2 > 0) {
                const isHorizontal = emp.categoria === 'Horizontal';
                if (isHorizontal) {
                    chartPizzaM2Horizontal.push({ name: emp.nome, value: areaTotalM2 });
                } else {
                    chartPizzaM2Vertical.push({ name: emp.nome, value: areaTotalM2 });
                }
            }

            const areaVendidaM2 = produtosVinculados.reduce((sum, p) => {
                const temContrato = !!rawData.contratoProdutos.find(cp => cp.produto_id === p.id);
                return (p.status === 'Vendido' || p.status === 'Permuta' || temContrato) ? sum + (Number(p.area_m2) || 0) : sum;
            }, 0);
            
            const areaEstoqueM2 = areaTotalM2 - areaVendidaM2;
            totalAreaTotalM2 += areaTotalM2;
            totalAreaVendidaM2 += areaVendidaM2;

            if (emp.categoria === 'Horizontal') {
                totalAreaHorizontal += areaTotalM2;
                totalVgvHorizontal += vgvTotal;
            } else {
                totalAreaVertical += areaTotalM2;
                totalVgvVertical += vgvTotal;
            }

            const qtdVendidoReal = produtosVinculados.filter(p => {
                const ligacao = rawData.contratoProdutos.find(cp => cp.produto_id === p.id);
                const temContratoFirme = ligacao ? contratos.some(c => c.id === ligacao.contrato_id && c.tipo_documento === 'CONTRATO') : false;
                return p.status === 'Vendido' || p.status === 'Permuta' || temContratoFirme;
            }).length;

            totalQtd += produtosVinculados.length;
            totalQtdVendida += qtdVendidoReal;

            return {
                ...emp,
                produtos: produtosVinculados,
                estatisticas: {
                    valorDisponivel: valorEstoqueListado,
                    valorVendido,
                    vgvTotal,
                    qtdTotal: produtosVinculados.length,
                    qtdDisponivel: produtosVinculados.length - qtdVendidoReal,
                    qtdVendido: qtdVendidoReal,
                    areaTotalM2,
                    areaVendidaM2,
                    areaEstoqueM2
                }
            };
        }).sort((a, b) => b.estatisticas.vgvTotal - a.estatisticas.vgvTotal);

        // Prepara Lista Flat de Produtos (Tabela Detalhada Visível)
        let produtosFormatados = [];
        for (const emp of empProcessados) {
            for (const prod of emp.produtos) {
                const ligacao = rawData.contratoProdutos.find(cp => cp.produto_id === prod.id);
                const contratoDoProduto = ligacao ? contratos.find(c => c.id === ligacao.contrato_id && c.tipo_documento === 'CONTRATO') : null;

                let valorAtualAjustado = Number(prod.valor_venda_calculado) || 0;

                if (contratoDoProduto) {
                    // Quando um contrato amarra MÚLTIPLOS produtos (Ex: Apto + Garagem de brinde)
                    const todosLinksDoContrato = rawData.contratoProdutos.filter(cp => cp.contrato_id === contratoDoProduto.id);
                    const produtosDoContrato = produtos.filter(p => todosLinksDoContrato.some(link => link.produto_id === p.id));
                    
                    const somaTabelaCombo = produtosDoContrato.reduce((acc, p) => acc + (Number(p.valor_venda_calculado) || 0), 0);

                    if (somaTabelaCombo > 0) {
                        const percentualDaFracao = (Number(prod.valor_venda_calculado) || 0) / somaTabelaCombo;
                        valorAtualAjustado = Number(contratoDoProduto.valor_final_venda) * percentualDaFracao;
                    } else {
                        // Muito raro (Vendeu apenas garagens que valem 0 por um preço X)
                        valorAtualAjustado = Number(contratoDoProduto.valor_final_venda) / produtosDoContrato.length;
                    }
                }
                
                produtosFormatados.push({
                    ...prod,
                    nome_empreendimento: emp.nome,
                    is_vendido: !!contratoDoProduto || prod.status === 'Vendido' || prod.status === 'Permuta',
                    valor_atual: valorAtualAjustado,
                });
            }
        }

        if (empreendimentoSelecionadoId !== 'ALL') {
            produtosFormatados = produtosFormatados.filter(p => p.empreendimento_id === Number(empreendimentoSelecionadoId));
        }

        const countTipos = {};
        for (const p of produtosFormatados) {
            const t = p.tipo || 'Não Informado';
            countTipos[t] = (countTipos[t] || 0) + 1;
        }
        const chartPizzaTipologias = Object.entries(countTipos).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        produtosFormatados.sort((a, b) => {
            if (a.empreendimento_id !== b.empreendimento_id) return a.empreendimento_id - b.empreendimento_id;
            return b.valor_atual - a.valor_atual;
        });

        // Sumário Exato
        const isAll = empreendimentoSelecionadoId === 'ALL';
        const targetEmp = isAll ? null : empProcessados.find(e => e.id === Number(empreendimentoSelecionadoId));

        const sumAreaTotal = isAll ? totalAreaTotalM2 : (targetEmp?.estatisticas?.areaTotalM2 || 0);
        const sumVgv = isAll ? totalVGVGlobal : (targetEmp?.estatisticas?.vgvTotal || 0);

        const statsFinal = {
            vgvConsolidado: sumVgv,
            vgvAssegurado: isAll ? totalValoresVendidos : (targetEmp?.estatisticas?.valorVendido || 0),
            m2Estoque: isAll ? (totalAreaTotalM2 - totalAreaVendidaM2) : (targetEmp?.estatisticas?.areaEstoqueM2 || 0),
            m2Vendido: isAll ? totalAreaVendidaM2 : (targetEmp?.estatisticas?.areaVendidaM2 || 0),
            qtdEstoque: isAll ? (totalQtd - totalQtdVendida) : (targetEmp?.estatisticas?.qtdDisponivel || 0),
            qtdVendida: isAll ? totalQtdVendida : (targetEmp?.estatisticas?.qtdVendido || 0),
            qtdTotal: isAll ? totalQtd : (targetEmp?.estatisticas?.qtdTotal || 0),
            ticketMedioHorizontal: isAll ? (totalAreaHorizontal > 0 ? totalVgvHorizontal / totalAreaHorizontal : 0) : (targetEmp?.categoria === 'Horizontal' && sumAreaTotal > 0 ? sumVgv / sumAreaTotal : 0),
            ticketMedioVertical: isAll ? (totalAreaVertical > 0 ? totalVgvVertical / totalAreaVertical : 0) : ((targetEmp?.categoria !== 'Horizontal') && sumAreaTotal > 0 ? sumVgv / sumAreaTotal : 0),
        };

        return { empreendimentos: empProcessados, chartPizzaVGV, chartPizzaM2Horizontal, chartPizzaM2Vertical, chartPizzaTipologias, produtosFormatados, estatisticasGlobais: statsFinal };
    }, [rawData, empreendimentoSelecionadoId]);

    // === 3. INTERFACE PADRÃO OURO ===
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-blue-500" />
                <p>Levantando dados físicos e valores contratuais...</p>
            </div>
        );
    }

    const { estatisticasGlobais: stats } = dataAgrupada;

    return (
        <div className="space-y-6 animate-fade-in p-2 min-h-[calc(100vh-100px)] flex flex-col">
            
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Relatório Visão Executiva</h1>
                    <p className="text-sm text-gray-500 mt-1">Análise Tática de Valor Geral de Vendas e Controle Físico de Obras.</p>
                </div>
                <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 p-1 pr-2">
                    <FontAwesomeIcon icon={faBuilding} className="text-gray-400 ml-3 mr-1" />
                    <select
                        className="pl-2 pr-4 py-2 bg-transparent outline-none text-sm font-medium focus:ring-0 text-gray-600 appearance-none cursor-pointer"
                        value={empreendimentoSelecionadoId}
                        onChange={(e) => setEmpreendimentoSelecionadoId(e.target.value)}
                    >
                        <option value="ALL">Todo o Portfólio (Consolidado)</option>
                        {dataAgrupada.empreendimentos.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* SEÇÃO 1: CARDS (KPIs Padrão RH) */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 shrink-0">
                <DashboardKpi 
                    title="VGV Total" 
                    value={formatCurrency(stats.vgvConsolidado)}
                    icon={faMoneyBillWave} bgIcon="bg-indigo-50" colorIcon="text-indigo-600"
                    subtext="Unid. Disponíveis/Reservadas + Contratos"
                    tooltip="Soma estrita do valor de unidades disponíveis ou reservadas + montante dos contratos de venda efetivamente assinados."
                />
                <DashboardKpi 
                    title="Vendas" 
                    value={formatCurrency(stats.vgvAssegurado)}
                    icon={faFileSignature} bgIcon="bg-emerald-50" colorIcon="text-emerald-600"
                    subtext={
                        <span><span className="font-bold text-gray-600">{(stats.vgvConsolidado > 0 ? (stats.vgvAssegurado / stats.vgvConsolidado * 100) : 0).toFixed(1)}%</span> do vgv</span>
                    }
                    tooltip="Valor estrito blindado e trancafiado por contratos com status 'Assinado'. Totalmente intocável em casos de variação de tabela do corretor."
                />
                <DashboardKpi 
                    title="Inventário (Físico)" 
                    value={`${stats.qtdEstoque} / ${stats.qtdVendida}`}
                    icon={faCube} bgIcon="bg-orange-50" colorIcon="text-orange-500"
                    subtext={<span>De um total de <span className="font-bold">{stats.qtdTotal} un.</span></span>}
                    tooltip="Relação de unidades em prateleira (Disponíveis) versus comercializadas (Vendidas)."
                />
                <DashboardKpi 
                    title="Índice VSO" 
                    value={`${stats.qtdTotal > 0 ? ((stats.qtdVendida / stats.qtdTotal) * 100).toFixed(1) : 0}%`}
                    icon={faTachometerAlt} bgIcon="bg-teal-50" colorIcon="text-teal-500"
                    subtext={<span>Escoamento do Estoque</span>}
                    tooltip="Vendas Sobre Oferta (Snaphot Acumulado). A fatia em percentual de tudo que já trancafiado em relação à oferta global total até o momento."
                />
                <DashboardKpi 
                    title="Ticket Horizontal" 
                    value={stats.ticketMedioHorizontal > 0 ? formatCurrency(stats.ticketMedioHorizontal) : '-'}
                    icon={faMap} bgIcon="bg-amber-50" colorIcon="text-amber-500"
                    subtext={<span>Preço Base/m² em Lotes</span>}
                    tooltip="Valor médio cobrado pelo m² de área privativa (VGV sobre Área Total) focado em Loteamentos."
                />
                <DashboardKpi 
                    title="Ticket Vertical" 
                    value={stats.ticketMedioVertical > 0 ? formatCurrency(stats.ticketMedioVertical) : '-'}
                    icon={faCity} bgIcon="bg-fuchsia-50" colorIcon="text-fuchsia-500"
                    subtext={<span>Preço Base/m² em Prédios</span>}
                    tooltip="Valor médio cobrado pelo m² de área privativa (VGV sobre Área Total) focado em Prédios."
                />
            </div>

            {/* SEÇÃO 2: GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Gráfico Pizza de VGV */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                        <span>Fatia de VGV / Obra</span>
                        <FontAwesomeIcon icon={faChartPie} className="text-indigo-400" />
                    </h3>
                    <div className="flex-1 w-full h-[250px]">
                        {dataAgrupada.chartPizzaVGV.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={dataAgrupada.chartPizzaVGV} 
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={75} 
                                        paddingAngle={3} dataKey="value" stroke="none"
                                        labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius * 1.2;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {name} ({(percent * 100).toFixed(0)}%)
                                                </text>
                                            );
                                        }}
                                    >
                                        {dataAgrupada.chartPizzaVGV.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                      formatter={(value) => [formatCurrency(value), 'VGV']} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-400 text-sm">Sem VGV ativo.</p>
                        )}
                    </div>
                </div>

                {/* Gráfico Pizza de Área M2 - Horizontal */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                        <span>Área Privativa Loteamentos</span>
                        <FontAwesomeIcon icon={faChartPie} className="text-amber-500" />
                    </h3>
                    <div className="flex-1 w-full h-[250px]">
                        {dataAgrupada.chartPizzaM2Horizontal && dataAgrupada.chartPizzaM2Horizontal.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={dataAgrupada.chartPizzaM2Horizontal} 
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={75} 
                                        paddingAngle={3} dataKey="value" stroke="none"
                                        labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius * 1.2;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {name} ({(percent * 100).toFixed(0)}%)
                                                </text>
                                            );
                                        }}
                                    >
                                        {dataAgrupada.chartPizzaM2Horizontal.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                      formatter={(value) => [`${formatNumber(value)} m²`, 'Área (Lotes)']} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex w-full h-full justify-center items-center">
                               <p className="text-gray-400 text-sm">Nenhum loteamento registrado.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Gráfico Pizza de Área M2 - Vertical */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                        <span>Área Privativa Vertical</span>
                        <FontAwesomeIcon icon={faChartPie} className="text-rose-400" />
                    </h3>
                    <div className="flex-1 w-full h-[250px]">
                        {dataAgrupada.chartPizzaM2Vertical && dataAgrupada.chartPizzaM2Vertical.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={dataAgrupada.chartPizzaM2Vertical} 
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={75} 
                                        paddingAngle={3} dataKey="value" stroke="none"
                                        labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius * 1.2;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            return (
                                                <text x={x} y={y} fill="#4b5563" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                    {name} ({(percent * 100).toFixed(0)}%)
                                                </text>
                                            );
                                        }}
                                    >
                                        {dataAgrupada.chartPizzaM2Vertical.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                      formatter={(value) => [`${formatNumber(value)} m²`, 'Área (Aptos/Salas)']} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex w-full h-full justify-center items-center">
                               <p className="text-gray-400 text-sm">Nenhum prédio registrado.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Gráfico Barras de Tipologias */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
                        <span>Distribuição de Tipologias</span>
                        <FontAwesomeIcon icon={faChartPie} className="text-emerald-400" />
                    </h3>
                    <div className="flex-1 w-full h-[250px]">
                        {dataAgrupada.chartPizzaTipologias && dataAgrupada.chartPizzaTipologias.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dataAgrupada.chartPizzaTipologias} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#6B7280' }} interval={0} />
                                    <YAxis hide />
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                      formatter={(value) => [`${value} unidades`, 'Quantidade']} 
                                      cursor={{ fill: '#F3F4F6' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                        {dataAgrupada.chartPizzaTipologias.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                        ))}
                                        <LabelList dataKey="value" position="top" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#4B5563' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-400 text-sm">Sem dados de tipologia.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* SEÇÃO 3: Tabela de Produtos Detalhados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden max-h-[450px]">
                     <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                            Micro-Auditoria: Produtos Listados
                        </h3>
                        <span className="bg-gray-100 text-gray-500 font-mono font-bold text-[10px] px-2 py-1 rounded-md">
                            {dataAgrupada.produtosFormatados.length} REGISTROS
                        </span>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                           <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 sticky top-0 font-bold border-b border-gray-100 shadow-sm z-10">
                               <tr>
                                   <th className="px-4 py-3 min-w-[200px]">Empreendimento e Unidade</th>
                                   <th className="px-4 py-3 text-center">Tipo Físico</th>
                                   <th className="px-4 py-3 text-right">Área M²</th>
                                   <th className="px-4 py-3 text-right">Preço Efetivo</th>
                                   <th className="px-4 py-3 text-right">Ticket (R$/m²)</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {dataAgrupada.produtosFormatados.map(p => (
                                   <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                       <td className="px-4 py-3">
                                           <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{p.unidade}</span>
                                                <span className="text-[10px] text-gray-400 tracking-wider truncate max-w-[180px]">{p.nome_empreendimento}</span>
                                           </div>
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                            <span className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                                {p.tipo || 'Lote'}
                                            </span>
                                       </td>
                                       <td className="px-4 py-3 text-right font-mono text-gray-600">
                                           {formatNumber(p.area_m2)} <span className="text-[10px]">m²</span>
                                       </td>
                                       <td className="px-4 py-3 text-right">
                                           {p.is_vendido ? (
                                                <span className="font-bold text-emerald-700">{formatCurrency(p.valor_atual)}</span>
                                           ) : (
                                                <span className="font-medium text-gray-600">{formatCurrency(p.valor_atual)}</span>
                                           )}
                                       </td>
                                       <td className="px-4 py-3 text-right font-mono text-[11px] text-gray-500">
                                           {p.area_m2 > 0 ? (
                                              <span className="font-bold">
                                                  {formatCurrency(p.valor_atual / p.area_m2)}
                                              </span>
                                           ) : '-'}
                                       </td>
                                   </tr>
                               ))}
                               {dataAgrupada.produtosFormatados.length === 0 && (
                                   <tr>
                                       <td colSpan="4" className="p-8 text-center text-gray-400">
                                            Nenhuma unidade para exibir.
                                       </td>
                                   </tr>
                               )}
                           </tbody>
                        </table>
                    </div>
                </div>

        </div>
    );
}

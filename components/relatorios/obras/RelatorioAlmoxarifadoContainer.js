"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpreendimento } from '@/contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faWarehouse, faBoxes, faTools, faCoins,
    faExclamationTriangle, faTrophy
} from '@fortawesome/free-solid-svg-icons';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);

export default function RelatorioAlmoxarifadoContainer() {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const { selectedEmpreendimento } = useEmpreendimento();

    const { data: kpis, isLoading, isError } = useQuery({
        queryKey: ['almoxarifado_kpis', organizacaoId, selectedEmpreendimento],
        queryFn: async () => {
            if (!organizacaoId) return null;
            const res = await supabase.rpc('get_almoxarifado_kpis', {
                p_organizacao_id: organizacaoId,
                p_empreendimento_id: selectedEmpreendimento || 'all'
            });
            if (res.error) throw res.error;
            return res.data;
        },
        enabled: !!organizacaoId
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-blue-600">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-blue-500" />
                <p className="font-semibold animate-pulse">Calculando valorização do estoque...</p>
            </div>
        );
    }

    if (isError || !kpis) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-red-500 bg-red-50 rounded-2xl border border-red-100">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-2" />
                <p className="font-bold">Erro ao processar fechamento do estoque.</p>
            </div>
        );
    }

    const {
        valor_total,
        quantidade_skus,
        quantidade_fisica,
        equipamentos_em_uso,
        top_valiosos,
        distribuicao_valor
    } = kpis;

    const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#6366F1'];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* INFORMAÇÃO DE FILTRO GLOBAL */}
            {selectedEmpreendimento === 'all' && (
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-xl shadow border border-blue-900 flex items-center gap-3">
                    <FontAwesomeIcon icon={faWarehouse} className="text-2xl text-blue-200" />
                    <div>
                        <h3 className="font-bold">Visão Global de Estoques</h3>
                        <p className="text-xs text-blue-100 mt-1">Os números abaixo representam a soma do patrimônio armazenado em <strong>Todas as Obras</strong> do Studio 57, como se fossem um único almoxarifado gigante.</p>
                    </div>
                </div>
            )}

            {/* KPIs SUPERIORES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <FontAwesomeIcon icon={faCoins} className="text-6xl text-emerald-900" />
                    </div>
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Valor do Inventário</h3>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                            <FontAwesomeIcon icon={faCoins} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-emerald-600 tracking-tight relative z-10">{formatCurrency(valor_total)}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mt-2 relative z-10">Levantamento financeiro a preço recente</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Volume Físico</h3>
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <FontAwesomeIcon icon={faBoxes} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-gray-800 tracking-tight">{formatNumber(quantidade_fisica)} <span className="text-sm font-semibold text-gray-400">itens</span></p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mt-2">Soma bruta de unidades (Uso + Disponível)</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">SKUs (Variedade)</h3>
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                            <FontAwesomeIcon icon={faWarehouse} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-gray-800 tracking-tight">{formatNumber(quantidade_skus)}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mt-2">Diferentes tipos de itens controlados</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Equip. em Operação</h3>
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                            <FontAwesomeIcon icon={faTools} />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-gray-800 tracking-tight">{formatNumber(equipamentos_em_uso)}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mt-2">Unidades retiradas do galpão no momento</p>
                </div>
            </div>

            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Gráfico Curva ABC: 10 Itens Mais Valiosos */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faTrophy} className="text-amber-500" />
                        Top 10 Itens de Maior Valor Unitário
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top_valiosos} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                                <XAxis type="number" tickFormatter={(val) => `R$ ${val / 1000}k`} />
                                <YAxis dataKey="nome" type="category" width={180} tick={{fontSize: 10}} />
                                <Tooltip
                                    formatter={(value) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="valor_total" name="Valor (R$)" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                                    {top_valiosos.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Distribuição do Patrimônio */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        Distribuição Financeira
                    </h3>
                    <div className="h-64 w-full flex-grow relative">
                         {distribuicao_valor.length === 0 ? (
                             <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
                         ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribuicao_valor}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distribuicao_valor.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Equipamento' ? '#F59E0B' : '#10B981'} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                         )}
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Total</span>
                            <span className="text-sm font-black text-gray-700">Composição</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

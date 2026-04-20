"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBuilding, faWallet, faMoneyBillTransfer, faScaleBalanced, faSpinner, faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export default function RelatorioBalancoPatrimonial() {
  const supabase = createClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const { data: balanco, isLoading, error } = useQuery({
    queryKey: ['balanco_patrimonial', organizacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_balanco_patrimonial', {
        p_organizacao_id: organizacaoId
      });
      if (error) throw error;
      return data;
    },
    enabled: !!organizacaoId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 text-gray-400">
        <FontAwesomeIcon icon={faSpinner} spin className="mr-2 text-2xl" />
        <span className="font-medium">Calculando Ativos e Passivos...</span>
      </div>
    );
  }

  if (error || !balanco) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
        Erro ao puxar dados do balanço patrimonial.
      </div>
    );
  }

  const ativosCaixa = Number(balanco.ativos_caixa || 0);
  const ativosImobilizados = Number(balanco.ativos_imobilizados || 0);
  const passivos = Math.abs(Number(balanco.passivos || 0));
  const vgvConstruido = Number(balanco.vgv_construido || 0);
  const patrimonioLiquido = Number(balanco.patrimonio_liquido || 0);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Dados para o Gráfico de Composição dos Ativos
  const chartDataAtivos = [
    { name: 'Caixa e Bancos (Liquidez)', value: ativosCaixa, color: '#10B981' },
    { name: 'Ativos Tangíveis (Físicos)', value: ativosImobilizados, color: '#F59E0B' },
    { name: 'VGV Construído (Estoque Físico)', value: vgvConstruido, color: '#3B82F6' },
  ].filter(d => d.value > 0);

  const totalAtivos = ativosCaixa + ativosImobilizados + vgvConstruido;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><FontAwesomeIcon icon={faScaleBalanced} /></span>
            Balanço Patrimonial
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Consolidação em tempo real do caixa, obrigações bancárias e avanços de engenharia.
          </p>
        </div>
      </div>

      {/* CARDS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ativos Caixa */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Disponibilidade (Caixa)</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <FontAwesomeIcon icon={faWallet} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 tracking-tight">{formatCurrency(ativosCaixa)}</p>
          <p className="text-xs text-gray-400 mt-2">Saldo bancário livre em contas correntes.</p>
        </div>

        {/* Ativos Tangíveis */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Ativos (Tangíveis)</h3>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
              <FontAwesomeIcon icon={faChartLine} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 tracking-tight">{formatCurrency(ativosImobilizados)}</p>
          <p className="text-xs text-gray-400 mt-2">Imobilizações como imóveis e bens registrados.</p>
        </div>

        {/* VGV Construido */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">P. Construído (VGV)</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <FontAwesomeIcon icon={faBuilding} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 tracking-tight">{formatCurrency(vgvConstruido)}</p>
          <p className="text-xs text-gray-400 mt-2">Volume do estoque validado em obras Físicas.</p>
        </div>

        {/* Passivos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-red-500 text-xs font-semibold uppercase tracking-wider">Passivos</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
              <FontAwesomeIcon icon={faMoneyBillTransfer} />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 tracking-tight">{formatCurrency(passivos)}</p>
          <p className="text-xs text-gray-400 mt-2">Volume consolidado de dívidas e alavancagem.</p>
        </div>
      </div>

      {/* SESSÃO PRINCIPAL DE PATRIMONIO LIQUIDO E GRÁFICO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Resultado Final Patrimônio Líquido */}
        <div className="lg:col-span-1 border-2 border-indigo-100 bg-gradient-to-b from-indigo-50 to-white rounded-3xl p-8 flex flex-col justify-center items-center text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl mb-4 shadow-sm border border-indigo-200">
            <FontAwesomeIcon icon={faScaleBalanced} />
          </div>
          <h2 className="text-sm font-bold text-indigo-800 uppercase tracking-widest mb-2">Patrimônio Líquido Real</h2>
          <p className={`text-5xl font-extrabold pb-2 bg-clip-text text-transparent ${patrimonioLiquido >= 0 ? 'bg-gradient-to-r from-emerald-600 to-indigo-600' : 'bg-gradient-to-r from-red-600 to-orange-600'}`}>
            {formatCurrency(patrimonioLiquido)}
          </p>
          <div className="mt-6 flex flex-col w-full gap-2 text-sm text-gray-600">
            <div className="flex justify-between border-b border-indigo-100 pb-1">
              <span>Soma Ativos Tangíveis</span>
              <span className="font-semibold text-gray-800">{formatCurrency(totalAtivos)}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span>Soma Passivos (- Dívidas)</span>
              <span className="font-semibold text-red-600">{formatCurrency(passivos)}</span>
            </div>
          </div>
        </div>

        {/* Composição Gráficas dos Ativos vs Passivos */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 flex flex-col shadow-sm">
          <h3 className="text-gray-800 font-bold mb-6">Composição de Ativos Totais</h3>
          <div className="flex-1 min-h-[250px] w-full relative">
            {totalAtivos > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataAtivos}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartDataAtivos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                Nenhum ativo detectado para compor o gráfico.
              </div>
            )}
          </div>
          <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs text-gray-500 text-center">
            Este gráfico avalia o montante positivo (dinheiro na conta + performance construtiva materializada). O percentual endividado no passivo deduz sobre esse montante integral.
          </div>
        </div>
      </div>
    </div>
  );
}

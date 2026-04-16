"use client";

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faCalendar, faSpinner, faChartColumn, faInfoCircle, faUsers, faArrowRightFromBracket, faArrowRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function RHTendencias() {
  const { user } = useAuth();
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());

  // RPC 1: Turnover
  const { data: turnoverData, isLoading: isLoadingTurnover } = useQuery({
    queryKey: ['rh-tendencia-turnover', anoSelecionado, user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_rh_tendencia_turnover', {
        p_ano: anoSelecionado,
        p_organizacao_id: user.organizacao_id
      });
      if (error) {
        console.error('Erro na RPC turnover:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.organizacao_id
  });

  // RPC 2: Absenteísmo
  const { data: absenteismoData, isLoading: isLoadingAbsenteismo } = useQuery({
    queryKey: ['rh-tendencia-absenteismo', anoSelecionado, user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_rh_tendencia_absenteismo', {
        p_ano: anoSelecionado,
        p_organizacao_id: user.organizacao_id
      });
      if (error) {
        console.error('Erro na RPC absenteismo:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.organizacao_id
  });

  // RPC 3: Abonos
  const { data: abonosRawData, isLoading: isLoadingAbonos } = useQuery({
    queryKey: ['rh-tendencia-abonos', anoSelecionado, user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_rh_tendencia_abonos', {
        p_ano: anoSelecionado,
        p_organizacao_id: user.organizacao_id
      });
      if (error) {
        console.error('Erro na RPC abonos:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.organizacao_id
  });

  const isLoading = isLoadingTurnover || isLoadingAbsenteismo || isLoadingAbonos;

  // Flatten abonos para o Recharts (Stacked Bar precisa de {mes: 'Jan', 'Atestado': 5, 'Folga': 2})
  const tiposAbonoColors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F43F5E', '#6366F1'];
  const allAbonoTipos = new Set();
  const abonosData = (abonosRawData || []).map(d => {
     const obj = { mes: d.mes, total_abonos: d.total_abonos };
     if (d.detalhes) {
        d.detalhes.forEach(det => {
           obj[det.tipo] = det.qtd;
           allAbonoTipos.add(det.tipo);
        });
     }
     return obj;
  });
  
  // HOTFIX: Se nenhum abono foi registrado no ano, o Recharts não monta nenhuma <Bar>, 
  // o que faz o gráfico ficar "invisível". Para evitar isso, inserimos uma Key falsa.
  if (allAbonoTipos.size === 0) {
      allAbonoTipos.add('Nenhum Registro');
  }
  
  const abonosTiposArray = Array.from(allAbonoTipos);
  
  // Garantir que todos os objetos tenham as chaves preenchidas com pelo menos 0, 
  // para forçar a montagem dos eixos XY no Recharts.
  abonosData.forEach(d => {
      abonosTiposArray.forEach(tipo => {
          if (d[tipo] === undefined) {
              d[tipo] = 0;
          }
      });
  });

  // Lista de anos para o seletor (do ano passado até o próximo)
  const anosDisponiveis = [
    (new Date().getFullYear() - 1).toString(),
    new Date().getFullYear().toString(),
    (new Date().getFullYear() + 1).toString(),
  ];

  // Cálculos consolidados para KPIs anuais (Turonver)
  const totalAdmissoesAnual = turnoverData?.reduce((acc, obj) => acc + (obj.admissoes || 0), 0) || 0;
  const totalDemissoesAnual = turnoverData?.reduce((acc, obj) => acc + (obj.demissoes || 0), 0) || 0;
  
  // O usuário se assustou com o 'Acumulado Anual' (que somava tudo e passava de 100%).
  // A abordagem gerencial mais fácil de ler é a Média das Taxas Mensais do ano:
  const taxasMensaisAtivas = turnoverData?.filter(d => typeof d.turnover_percentual === 'number' && d.efetivo > 0).map(d => d.turnover_percentual) || [];
  const rotatividadeMediaMensal = taxasMensaisAtivas.length > 0 
    ? taxasMensaisAtivas.reduce((acc, v) => acc + v, 0) / taxasMensaisAtivas.length 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {/* HEADER DE FILTRO ANUAL */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartLine} className="text-blue-600" />
            Tendências Históricas (Série Anual)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhe a evolução de métricas vitais da equipe ao longo de todo o ano.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-600 flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendar} className="text-gray-400" />
            Período:
          </label>
          <select 
            value={anoSelecionado}
            onChange={(e) => setAnoSelecionado(e.target.value)}
            className="border-gray-200 rounded-lg p-2 text-sm font-medium focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-gray-800 cursor-pointer outline-none"
          >
            {anosDisponiveis.map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
          <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-4" />
          <p className="font-medium animate-pulse">Cruzando milhões de dados do banco pelo Motor V8...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* GRÁFICO 1: Turnover e Efetivo */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xl">
                     <FontAwesomeIcon icon={faChartLine} />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-gray-800">Evolução de Efetivo e Taxa de Rotatividade</h3>
                     <p className="text-sm text-gray-500">Acompanhamento do quadro de funcionários vs Taxa de rotatividade.</p>
                  </div>
               </div>
               <div className="group relative cursor-help">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300 hover:text-blue-500 text-lg transition-colors" />
                  <div className="absolute right-0 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 top-full mt-2 shadow-xl border border-gray-700">
                    <p className="font-bold mb-1 border-b border-gray-700 pb-1">📊 Motor de Rotatividade Anual</p>
                    <p>O <b>Efetivo</b> reflete a quantidade de colaboradores ativos que trabalharam em algum momento no mês.</p>
                    <p className="mt-1">A linha de <b>Rotatividade (%)</b> representa a equação oficial: <i>((Admissões + Demissões) / 2) ÷ Efetivo * 100</i>.</p>
                  </div>
               </div>
            </div>

            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={turnoverData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                     <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                     <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: '500' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                     />
                     <Legend wrapperStyle={{ paddingTop: '20px' }} />
                     
                     <Bar yAxisId="left" dataKey="efetivo" name="Quadro Ativo (Efetivo)" fill="#93C5FD" radius={[4, 4, 0, 0]} barSize={40} />
                     <Line yAxisId="right" type="monotone" dataKey="turnover_percentual" name="Taxa Rotatividade (%)" stroke="#DC2626" strokeWidth={3} dot={{ r: 4, fill: '#DC2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
            
            {/* Cards de Resumo Abaixo do Gráfico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
               <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-indigo-500"><FontAwesomeIcon icon={faUsers} /></div>
                  <div>
                     <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider leading-tight">Pico de Efetivo<br/>(Ativos no Ano)</p>
                     <p className="text-xl font-black text-gray-800">{Math.max(...(turnoverData?.map(d => d.efetivo) || [0]))}</p>
                  </div>
               </div>
               <div className="bg-green-50 rounded-xl p-4 flex items-center gap-4 border border-green-100/50">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-green-600"><FontAwesomeIcon icon={faArrowRightToBracket} /></div>
                  <div>
                     <p className="text-[10px] text-green-700 uppercase font-bold tracking-wider leading-tight">Total Admissões<br/>(Acumulado)</p>
                     <p className="text-xl font-black text-green-800">{totalAdmissoesAnual}</p>
                  </div>
               </div>
               <div className="bg-red-50 rounded-xl p-4 flex items-center gap-4 border border-red-100/50">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-red-600"><FontAwesomeIcon icon={faArrowRightFromBracket} /></div>
                  <div>
                     <p className="text-[10px] text-red-700 uppercase font-bold tracking-wider leading-tight">Total Demissões<br/>(Acumulado)</p>
                     <p className="text-xl font-black text-red-800">{totalDemissoesAnual}</p>
                  </div>
               </div>
               <div className="bg-orange-50 rounded-xl p-4 flex items-center gap-4 border border-orange-100/50">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-orange-500"><FontAwesomeIcon icon={faChartLine} /></div>
                  <div>
                     <p className="text-[10px] text-orange-700 uppercase font-bold tracking-wider leading-tight">Taxa Rotatividade<br/>(Média Mensal do Ano)</p>
                     <p className="text-xl font-black text-orange-800">{rotatividadeMediaMensal.toFixed(1)}%</p>
                  </div>
               </div>
            </div>

          </div>

          {/* GRÁFICO 2: Curva de Absenteísmo */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center text-xl">
                     <FontAwesomeIcon icon={faChartLine} />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-gray-800">Curva de Absenteísmo Anual</h3>
                     <p className="text-sm text-gray-500">Volume de faltas mapeadas vs dias úteis exigidos da equipe.</p>
                  </div>
               </div>
               <div className="group relative cursor-help">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300 hover:text-blue-500 text-lg transition-colors" />
                  <div className="absolute right-0 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 top-full mt-2 shadow-xl border border-gray-700">
                    <p className="font-bold mb-1 border-b border-gray-700 pb-1">📊 Motor de Absenteísmo</p>
                    <p>Mede a porcentagem de ausências <b>não justificadas</b> no período.</p>
                    <p className="mt-1">Fórmula oficial Studio 57: <i>(Total de Faltas ÷ Total de Dias Exigidos no Mês) * 100</i>.</p>
                  </div>
               </div>
            </div>

            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={absenteismoData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                     <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                     <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: '500' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                     />
                     <Legend wrapperStyle={{ paddingTop: '20px' }} />
                     
                     <Bar yAxisId="left" dataKey="total_faltas" name="Total de Faltas Dadas" fill="#FCA5A5" radius={[4, 4, 0, 0]} barSize={40} />
                     <Line yAxisId="right" type="monotone" dataKey="absenteismo_percentual" name="Absenteísmo (%)" stroke="#991B1B" strokeWidth={3} dot={{ r: 4, fill: '#991B1B', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
            
            {/* Cards de Resumo Abaixo do Gráfico */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
               <div className="bg-red-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-red-500"><FontAwesomeIcon icon={faUsers} /></div>
                  <div>
                     <p className="text-xs text-red-700 uppercase font-bold tracking-wider">Total de Faltas Acumuladas</p>
                     <p className="text-xl font-black text-red-800">{absenteismoData?.reduce((acc, obj) => acc + (obj.total_faltas || 0), 0) || 0} dias</p>
                  </div>
               </div>
               <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 border border-gray-100/50">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-gray-500"><FontAwesomeIcon icon={faCalendar} /></div>
                  <div>
                     <p className="text-xs text-gray-600 uppercase font-bold tracking-wider">Dias Úteis Mapeados</p>
                     <p className="text-xl font-black text-gray-800">{absenteismoData?.reduce((acc, obj) => acc + (obj.dias_exigidos || 0), 0) || 0}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* GRÁFICO 3: Abonos Empilhados */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-xl">
                     <FontAwesomeIcon icon={faChartColumn} />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-gray-800">Raio-X Anual de Abonos</h3>
                     <p className="text-sm text-gray-500">Volume de justificativas (atestados, folgas, atrasos perdoados) distribuídos por tipo.</p>
                  </div>
               </div>
               <div className="group relative cursor-help">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300 hover:text-blue-500 text-lg transition-colors" />
                  <div className="absolute right-0 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 top-full mt-2 shadow-xl border border-gray-700">
                    <p className="font-bold mb-1 border-b border-gray-700 pb-1">📊 Motor de Abonos Anual</p>
                    <p>Mapeia rigorosamente os dias abonados agrupados pela sua classificação (Atestado Médico, Folga Compensatória, Falta Explicada, etc).</p>
                  </div>
               </div>
            </div>

            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={abonosData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                     <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: '500' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                     />
                     <Legend wrapperStyle={{ paddingTop: '20px' }} />
                     
                     {abonosTiposArray.map((tipo, index) => (
                         // Ativando o Stack vinculando todos ao mesmo stackId
                         <Bar key={tipo} dataKey={tipo} name={tipo} stackId="stack_abonos" fill={tiposAbonoColors[index % tiposAbonoColors.length]} barSize={40} />
                     ))}
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
            
            {/* Cards de Resumo Abaixo do Gráfico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
               <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-emerald-500"><FontAwesomeIcon icon={faChartColumn} /></div>
                  <div>
                     <p className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider leading-tight">Total de Abonos<br/>(Bimestral/Anual)</p>
                     <p className="text-xl font-black text-emerald-800">{abonosData?.reduce((acc, obj) => acc + (obj.total_abonos || 0), 0) || 0} dias</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

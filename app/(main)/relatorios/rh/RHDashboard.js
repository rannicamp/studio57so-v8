"use client";

import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, faUserPlus, faUserMinus, faExchangeAlt, 
  faCalendarTimes, faMedal, faExclamationTriangle, faClock,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

const DashboardKpi = ({ title, value, icon, bgIcon, colorIcon, subtext, tooltip }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <div className="flex items-center gap-1 mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
        {tooltip && (
          <div className="relative flex items-center group">
            <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300 hover:text-blue-500 cursor-help transition-colors text-xs" />
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 mt-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-xl shadow-xl z-50 normal-case font-medium pointer-events-none">
              <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <h3 className="text-3xl font-extrabold text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-2 font-medium">{subtext}</p>}
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgIcon} ${colorIcon}`}>
      <FontAwesomeIcon icon={icon} className="text-xl" />
    </div>
  </div>
);

export default function RHDashboard({ fechamento, totais, mesRef }) {
  
  const metricas = useMemo(() => {
    if (!fechamento || fechamento.length === 0) return null;

    // Filtra apenas funcionários que possuem jornada de trabalho vinculada (exclui sócios e diretoria das métricas)
    const equipeValida = fechamento.filter(f => f.jornada_id);

    let admissões = 0;
    let demissões = 0;
    let totalFaltas = 0;
    let totalDiasUteisExigidos = 0;

    equipeValida.forEach(f => {
      // Movimentação
      if (f.admission_date && f.admission_date.startsWith(mesRef)) admissões++;
      if (f.demission_date && f.demission_date.startsWith(mesRef)) demissões++;
      
      // Absenteísmo
      totalFaltas += (f.faltas || 0);
      totalDiasUteisExigidos += (f.diasUteisExigidos || 0);
    });

    const headcount = equipeValida.length;
    
    // Turnover: ((Admissões + Demissões) / 2) / Headcount * 100
    const turnoverVal = headcount > 0 ? (((admissões + demissões) / 2) / headcount) * 100 : 0;
    
    // Taxa de Absenteísmo: Faltas / Dias Úteis Exigidos Totais * 100
    const absenteismoVal = totalDiasUteisExigidos > 0 ? (totalFaltas / totalDiasUteisExigidos) * 100 : 0;

    // Gráfico de Custo por Empreendimento
    const custoPorEmpObj = {};
    equipeValida.forEach(f => {
      const empName = f.empreendimentos?.nome || 'Alocação Padrão / Matriz';
      if (!custoPorEmpObj[empName]) custoPorEmpObj[empName] = 0;
      custoPorEmpObj[empName] += f.custoBruto;
    });

    const graficoCustoEmpreendimento = Object.keys(custoPorEmpObj).map(key => ({
      name: key,
      Custo: parseFloat(custoPorEmpObj[key].toFixed(2))
    })).sort((a,b) => b.Custo - a.Custo);

    // Gráfico Headcount por Cargo
    const hcPorCargoObj = {};
    equipeValida.forEach(f => {
        const cargoName = f.cargos?.nome || 'Sem Cargo';
        if (!hcPorCargoObj[cargoName]) hcPorCargoObj[cargoName] = 0;
        hcPorCargoObj[cargoName]++;
    });
    
    const graficoCargos = Object.keys(hcPorCargoObj).map(key => ({
        name: key,
        value: hcPorCargoObj[key]
    })).sort((a,b) => b.value - a.value);

    // Processamento do Gráfico de Ranking de Abonos
    const abonosMap = {};
    (fechamento.__abonos_resumo || []).forEach(ab => {
        // Ignora abonos de diretores fora da equipe válida
        if (!equipeValida.some(f => f.id === ab.funcionario_id)) return;
        const desc = ab.abono_tipos?.descricao || 'Outros (Não classificado)';
        if (!abonosMap[desc]) abonosMap[desc] = 0;
        abonosMap[desc]++;
    });
    
    const graficoAbonos = Object.entries(abonosMap)
       .map(([name, count]) => ({ name, Quantidade: count }))
       .sort((a,b) => b.Quantidade - a.Quantidade);

    // Rankings
    const topFaltosos = [...equipeValida].filter(f => f.faltas > 0).sort((a,b) => b.faltas - a.faltas).slice(0, 5);
    const topAtrasados = [...equipeValida].filter(f => f.atrasos > 0).sort((a,b) => b.atrasos - a.atrasos).slice(0, 5);
    const topHorasExtras = [...equipeValida].filter(f => f.saldoMinutosPuro > 0).sort((a,b) => b.saldoMinutosPuro - a.saldoMinutosPuro).slice(0, 5);

    const abonosPorFuncionario = {};
    (fechamento.__abonos_resumo || []).forEach(ab => {
        if (!abonosPorFuncionario[ab.funcionario_id]) abonosPorFuncionario[ab.funcionario_id] = 0;
        abonosPorFuncionario[ab.funcionario_id]++;
    });
    const topAbonados = [...equipeValida]
       .filter(f => abonosPorFuncionario[f.id] > 0)
       .map(f => ({ ...f, qtdAbonos: abonosPorFuncionario[f.id] }))
       .sort((a,b) => b.qtdAbonos - a.qtdAbonos)
       .slice(0, 5);

    return {
      admissões, demissões, turnover: turnoverVal.toFixed(1),
      totalFaltas, absenteismo: absenteismoVal.toFixed(1),
      graficoCustoEmpreendimento,
      graficoCargos,
      graficoAbonos,
      topFaltosos, topAtrasados, topHorasExtras, topAbonados,
      headcount
    };
  }, [fechamento, mesRef]);

  if (!metricas) return (
    <div className="flex flex-col items-center justify-center p-20 text-gray-400">
      <p>Ainda não há dados matemáticos consolidados para desenhar o Painel neste mês.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      
      {/* SEÇÃO 1: VISÃO GERAL & MOVIMENTAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardKpi 
          title="Efetivo Total" 
          value={metricas.headcount}
          icon={faUsers} bgIcon="bg-blue-50" colorIcon="text-blue-600"
          subtext="Colaboradores processados no mês"
        />
        <DashboardKpi 
          title="Taxa de Rotatividade" 
          value={`${metricas.turnover}%`}
          icon={faExchangeAlt} bgIcon="bg-orange-50" colorIcon="text-orange-500"
          subtext={<span><span className="text-green-600 font-bold">+{metricas.admissões} ent</span> / <span className="text-red-500 font-bold">-{metricas.demissões} sai</span></span>}
          tooltip="Calculado por: ((Admissões do Mês + Demissões do Mês) ÷ 2) ÷ Efetivo Total Válido."
        />
        <DashboardKpi 
          title="Tx. Absenteísmo" 
          value={`${metricas.absenteismo}%`}
          icon={faCalendarTimes} bgIcon="bg-red-50" colorIcon="text-red-500"
          subtext={`${metricas.totalFaltas} Faltas (Dias perdidos integrais)`}
          tooltip="Calculado por: (Total de Faltas ÷ Total de Dias Úteis Exigidos da Equipe) × 100."
        />
        <DashboardKpi 
          title="Massa Salarial (Bruta)" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totais.custo)}
          icon={faClock} bgIcon="bg-emerald-50" colorIcon="text-emerald-600"
          subtext="Custo total estimado da competência"
        />
      </div>

      {/* SEÇÃO 2: GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Headcount por Cargo (Pizza) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2">
            Distribuição de Efetivo (Cargos)
          </h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                    data={metricas.graficoCargos} 
                    cx="50%" cy="50%" innerRadius={50} outerRadius={100} 
                    paddingAngle={3} dataKey="value"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold" className="drop-shadow-md">
                                {value}
                            </text>
                        );
                    }}
                >
                  {metricas.graficoCargos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val) => [`${val} pessoas`, 'Efetivo']} 
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: '500' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Custo por Empreendimento (Barras Customizadas Tailwind e Recharts) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2">
            Massa Salarial Custeada por Empreendimento
          </h3>
          <div className="flex-1 w-full h-[250px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metricas.graficoCustoEmpreendimento} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" fontSize={11} tickFormatter={(val) => `R$${val/1000}k`} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" fontSize={10} width={120} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                />
                <Bar dataKey="Custo" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20}>
                    {metricas.graficoCustoEmpreendimento.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Frequência de Tipos de Abono */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 border-b pb-2">
            Tipos de Abono mais Frequentes
          </h3>
          <div className="flex-1 w-full h-[250px] mt-2">
            {metricas.graficoAbonos.length === 0 ? (
                <div className="flex items-center justify-center w-full h-full text-sm text-gray-400">Nenhum abono registrado! 🎉</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricas.graficoAbonos} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" fontSize={10} width={120} axisLine={false} tickLine={false} />
                    <Tooltip 
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val) => [`${val} registros`]}
                    />
                    <Bar dataKey="Quantidade" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20}>
                        {metricas.graficoAbonos.map((entry, index) => (
                            <Cell key={`cell-abono-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* SEÇÃO 3: RANKINGS E TERMOTERAPIA */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Risco: Faltosos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} /> Indicador de Risco: Absenteísmo (Top 5)
            </h3>
          </div>
          <div className="divide-y divide-gray-100 p-2">
            {metricas.topFaltosos.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">Nenhum funcionário com faltas. Equipe exemplar! 🎉</div>
            ) : (
                metricas.topFaltosos.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-mono font-bold text-sm">#{i+1}</span>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{f.full_name}</p>
                                <p className="text-xs text-gray-500">{f.cargos?.nome || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                {f.faltas} Faltas Integrais
                            </span>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Risco: Atrasos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} /> Indicador: Atrasos (Top 5)
            </h3>
          </div>
          <div className="divide-y divide-gray-100 p-2">
            {metricas.topAtrasados.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">Nenhum atraso fora da tolerância! 👏</div>
            ) : (
                metricas.topAtrasados.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-mono font-bold text-sm">#{i+1}</span>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{f.full_name}</p>
                                <p className="text-xs text-gray-500">{f.cargos?.nome || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                {f.atrasos} Atrasos
                            </span>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Custo/Produtividade: Horas Extras */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faMedal} /> Acúmulo de Horas Extras/Banco (Top 5)
            </h3>
          </div>
          <div className="divide-y divide-gray-100 p-2">
            {metricas.topHorasExtras.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">Ninguém extrapolou a jornada prevista. Custo sob controle! ✔️</div>
            ) : (
                metricas.topHorasExtras.map((f, i) => {
                    const absMins = Math.abs(f.saldoMinutosPuro);
                    const bStr = `+${Math.floor(absMins/60)}:${String(Math.floor(absMins%60)).padStart(2,'0')}h`;

                    return (
                    <div key={f.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-mono font-bold text-sm">#{i+1}</span>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{f.full_name}</p>
                                <p className="text-xs text-gray-500">{f.cargos?.nome || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm font-mono">
                                {bStr}
                            </span>
                        </div>
                    </div>
                )})
            )}
          </div>
        </div>

        {/* Mais Abonos: Top Abonados */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                <FontAwesomeIcon icon={faMedal} className="text-purple-500" /> Rank: Mais Abonos
            </h3>
          </div>
          <div className="divide-y divide-gray-100 p-2">
            {metricas.topAbonados.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">Nenhum abono concedido! 📎</div>
            ) : (
                metricas.topAbonados.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-mono font-bold text-sm">#{i+1}</span>
                            <div>
                                <p className="font-bold text-gray-800 text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px] sm:max-w-full" title={f.full_name}>{f.full_name}</p>
                                <p className="text-xs text-gray-500">{f.cargos?.nome || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm inline-block">
                                {f.qtdAbonos} Abonos
                            </span>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

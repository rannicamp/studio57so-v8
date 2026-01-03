// components/relatorios/financeiro/FinanceiroDashboard.js
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRelatorioFinanceiro } from '@/hooks/financeiro/useRelatorioFinanceiro';
import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro'; // Importamos seu componente!
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  startOfMonth, endOfMonth, format, addMonths, subMonths, isSameMonth 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowUp, faArrowDown, faWallet, faSpinner, faExclamationTriangle, faSync, 
  faChevronLeft, faChevronRight, faCalendarAlt, faFilter 
} from '@fortawesome/free-solid-svg-icons';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function FinanceiroDashboard() {
  const { user } = useAuth();
  
  // 1. Estado do Período (Nosso Carrossel)
  const [dataBase, setDataBase] = useState(new Date());

  // 2. Estado dos Filtros Avançados (Vindos do FiltroFinanceiro)
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    contas: [],
    categorias: [],
    status: [] // Opcional, se quiser filtrar status também
  });

  // Mostra/Esconde a barra de filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Gera o menu de meses
  const menuMeses = useMemo(() => {
    const meses = [];
    for (let i = -2; i <= 2; i++) {
      meses.push(addMonths(dataBase, i));
    }
    return meses;
  }, [dataBase]);

  // Prepara os filtros para o Hook
  const filtrosHook = useMemo(() => {
    return {
      startDate: startOfMonth(dataBase),
      endDate: endOfMonth(dataBase),
      organizacaoId: user?.organizacao_id,
      contaIds: filtrosAvancados.contas,        // Passa IDs das contas
      categoriaIds: filtrosAvancados.categorias // Passa IDs das categorias
    };
  }, [dataBase, user?.organizacao_id, filtrosAvancados]);

  // Hook busca os dados
  const { kpis, graficoFluxo, graficoPizza, isLoading, error, refetch } = useRelatorioFinanceiro(filtrosHook);

  // Navegação
  const navegarMes = (mes) => setDataBase(mes);
  const proximoMes = () => setDataBase(addMonths(dataBase, 1));
  const anteriorMes = () => setDataBase(subMonths(dataBase, 1));
  const irParaHoje = () => setDataBase(new Date());

  // Função chamada quando o usuário muda algo no FiltroFinanceiro
  const handleFiltroChange = (novosFiltros) => {
    setFiltrosAvancados(prev => ({
      ...prev,
      contas: novosFiltros.conta_id ? [novosFiltros.conta_id] : [], // Adapte conforme seu Filtro retorna array ou único
      categorias: novosFiltros.categoria_id ? [novosFiltros.categoria_id] : [],
      // Se o seu FiltroFinanceiro retornar arrays, use direto: novosFiltros.contas
    }));
    
    // Nota: Analisando seu componente FiltroFinanceiro original, ele geralmente retorna 
    // um objeto com { conta_id, categoria_id, ... }. 
    // Vou assumir aqui que ele passa esses valores.
    // Se o FiltroFinanceiro for complexo, basta garantir que 'filtrosAvancados' receba os IDs.
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 text-red-500 bg-red-50 rounded-2xl p-8 border border-red-100 mx-4">
      <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
      <p>Erro ao carregar dados: {error.message}</p>
      <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Tentar Novamente</button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* === 1. HEADER E NAVEGAÇÃO === */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 px-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                Painel Financeiro
            </h2>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => setMostrarFiltros(!mostrarFiltros)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${
                        mostrarFiltros ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    <FontAwesomeIcon icon={faFilter} />
                    Filtros Avançados
                </button>
                <button 
                    onClick={irParaHoje}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faCalendarAlt} /> Hoje
                </button>
            </div>
        </div>

        {/* ÁREA DE FILTROS (Expansível) */}
        {mostrarFiltros && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-slide-down">
                {/* Aqui entra seu componente existente! 
                    Passamos ocultarData={true} para não conflitar com o carrossel se o componente suportar */}
                <FiltroFinanceiro 
                    onFilterChange={handleFiltroChange} 
                    filtrosAtuais={filtrosAvancados}
                    compacto={true} // Se tiver essa prop para ficar menor
                />
            </div>
        )}

        {/* CARROSSEL DE MESES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex items-center justify-between">
            <button onClick={anteriorMes} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <div className="flex-1 flex justify-around items-center overflow-hidden gap-1">
                {menuMeses.map((mes, index) => {
                    const isSelected = isSameMonth(mes, dataBase);
                    const hiddenOnMobile = index === 0 || index === 4 ? 'hidden sm:block' : ''; 
                    return (
                        <button
                            key={mes.toString()}
                            onClick={() => navegarMes(mes)}
                            className={`${hiddenOnMobile} flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-all ${isSelected ? 'bg-blue-50 text-blue-700 scale-105 border border-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="text-xs font-semibold uppercase">{format(mes, 'yyyy', { locale: ptBR })}</span>
                            <span className="text-sm font-bold capitalize">{format(mes, 'MMMM', { locale: ptBR })}</span>
                        </button>
                    );
                })}
            </div>
            <button onClick={proximoMes} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <FontAwesomeIcon icon={faChevronRight} />
            </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
            <p>Processando dados...</p>
        </div>
      ) : (
        <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard titulo="Receitas" valor={kpis?.receita} icon={faArrowUp} corIcone="text-emerald-500" bgIcone="bg-emerald-50" />
                <KpiCard titulo="Despesas" valor={kpis?.despesa} icon={faArrowDown} corIcone="text-red-500" bgIcone="bg-red-50" />
                <KpiCard titulo="Saldo" valor={kpis?.saldo} icon={faWallet} corIcone={kpis?.saldo >= 0 ? "text-blue-500" : "text-orange-500"} bgIcone={kpis?.saldo >= 0 ? "bg-blue-50" : "bg-orange-50"} destaque />
            </div>

            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Fluxo Diário */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div> Fluxo Diário
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={graficoFluxo}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                                <Tooltip 
                                    cursor={{fill: '#F3F4F6'}}
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                    formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                                />
                                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                                <Bar name="Receita" dataKey="Receita" fill="#10B981" radius={[4, 4, 0, 0]} />
                                <Bar name="Despesa" dataKey="Despesa" fill="#EF4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pizza */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <div className="w-1 h-6 bg-orange-500 rounded-full"></div> Top Despesas
                    </h3>
                    <div className="h-80 flex items-center justify-center">
                        {graficoPizza.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={graficoPizza} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value">
                                        {graficoPizza.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-400">Sem dados de despesas neste filtro.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ titulo, valor, icon, corIcone, bgIcone, destaque = false }) {
    return (
        <div className={`p-6 rounded-2xl shadow-sm border transition-all ${destaque ? 'bg-white border-blue-200 ring-2 ring-blue-50' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{titulo}</h3>
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${bgIcone} ${corIcone}`}>
              <FontAwesomeIcon icon={icon} className="text-lg" />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight ${destaque ? 'text-blue-600' : 'text-gray-800'}`}>
            {(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
    );
}
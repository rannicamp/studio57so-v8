"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LineChart, Line, BarChart, Bar, XAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Cell
} from 'recharts';
import { format, isSameMonth, isSameDay, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';

const LARGURA_ITEM_PX = 60; 

export default function SmartChartCard({ kpi, onEdit, onDelete }) {
  const supabase = createClient();
  const { user } = useAuth();
  
  const { filtros = {}, agrupamento_tempo = 'mes', tipo_visualizacao = 'grafico_linha' } = kpi || {};
  
  const scrollContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState('100%');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- 1. BUSCA DE DADOS ---
  const { data: dadosBrutos = [], isLoading, error } = useQuery({
    queryKey: ['chart_data', kpi?.id, filtros, user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];

      let query = supabase
        .from('lancamentos')
        // SOLICITAÇÃO ATUALIZADA: Trazendo data_pagamento e data_vencimento para a lógica inteligente
        .select('id, valor, data_transacao, data_pagamento, data_vencimento, tipo, status, categoria_id, transferencia_id')
        .eq('organizacao_id', user.organizacao_id);

      // --- FILTROS ---
      if (filtros.tipo) {
        if (Array.isArray(filtros.tipo) && filtros.tipo.length > 0) {
           query = query.in('tipo', filtros.tipo);
        } else if (typeof filtros.tipo === 'string' && filtros.tipo !== 'todos') {
           query = query.eq('tipo', filtros.tipo);
        }
      }
      
      if (filtros.status) {
        if (Array.isArray(filtros.status) && filtros.status.length > 0) {
            if (!filtros.status.includes('todos')) {
                query = query.in('status', filtros.status);
            }
        } else if (typeof filtros.status === 'string' && filtros.status !== 'todos') {
            query = query.eq('status', filtros.status);
        }
      }

      if (Array.isArray(filtros.categorias) && filtros.categorias.length > 0) {
        const idsCategorias = filtros.categorias.map(c => (typeof c === 'object' && c !== null ? c.id : c));
        query = query.in('categoria_id', idsCategorias);
      }

      // IMPORTANTE: O filtro de data no banco ainda usa data_transacao ou data_vencimento como base primária
      // para não trazer o banco inteiro, mas a filtragem fina visual será feita no useMemo.
      // Aqui usamos uma lógica abrangente para garantir que pegamos tudo que pode cair no período.
      if (filtros.data_inicio && filtros.data_inicio.trim() !== '') {
        // Busca um pouco mais amplo para garantir
        query = query.or(`data_vencimento.gte.${filtros.data_inicio},data_pagamento.gte.${filtros.data_inicio},data_transacao.gte.${filtros.data_inicio}`);
      }
      if (filtros.data_fim && filtros.data_fim.trim() !== '') {
         query = query.or(`data_vencimento.lte.${filtros.data_fim},data_pagamento.lte.${filtros.data_fim},data_transacao.lte.${filtros.data_fim}`);
      }

      // --- CORREÇÃO 1: OCULTAR TRANSFERÊNCIAS ---
      if (filtros.ignoreTransfers) {
        query = query.is('transferencia_id', null);
      }

      // --- CORREÇÃO 2: OCULTAR ESTORNOS (VACINA DUPLA 189 e 308) ---
      if (filtros.ignoreChargebacks) {
        query = query.not('categoria_id', 'in', '(189,308)');
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.organizacao_id && !!kpi, 
    staleTime: 1000 * 60 * 5, 
  });

  // --- 2. INTELIGÊNCIA DE DADOS (PROCESSAMENTO NO CLIENTE) ---
  const { dadosFormatados, indexAtual, resumoTipo } = useMemo(() => {
    if (!dadosBrutos?.length) return { dadosFormatados: [], indexAtual: -1, resumoTipo: 'Misto' };

    // Define legenda baseada no que VEIO do banco (garante que não mistura visualmente)
    const temReceita = dadosBrutos.some(d => d.tipo === 'Receita');
    const temDespesa = dadosBrutos.some(d => d.tipo === 'Despesa');
    
    // Se o filtro for explícito, forçamos o tipo
    const filtroTipo = Array.isArray(filtros.tipo) ? filtros.tipo[0] : filtros.tipo;
    
    let tipoCalculo = 'saldo'; 
    let labelLegenda = 'Saldo';

    if ((filtros.tipo && filtroTipo === 'Receita') || (temReceita && !temDespesa)) {
        tipoCalculo = 'receita_pura';
        labelLegenda = 'Receita';
    } else if ((filtros.tipo && filtroTipo === 'Despesa') || (!temReceita && temDespesa)) {
        tipoCalculo = 'despesa_pura';
        labelLegenda = 'Despesa';
    }

    const agrupado = dadosBrutos.reduce((acc, item) => {
      // --- LÓGICA INTELIGENTE DE DATA ---
      // 1. Se pago/conciliado -> Data de Pagamento
      // 2. Se pendente -> Data de Vencimento
      // 3. Fallback -> Data de Transação
      
      let dataParaUso = item.data_transacao; // Fallback inicial
      const isPago = item.status === 'Pago' || item.status === 'Conciliado';

      if (isPago && item.data_pagamento) {
          dataParaUso = item.data_pagamento;
      } else if (!isPago && item.data_vencimento) {
          dataParaUso = item.data_vencimento;
      }

      if (!dataParaUso) return acc; // Segurança

      // Verifica se a data está dentro do range do filtro (pós-processamento para precisão)
      if (filtros.data_inicio && dataParaUso < filtros.data_inicio) return acc;
      if (filtros.data_fim && dataParaUso > filtros.data_fim) return acc;

      // --- AGRUPAMENTO TEMPORAL ---
      const [anoStr, mesStr, diaStr] = dataParaUso.split('T')[0].split('-');
      
      let chave = '';
      if (agrupamento_tempo === 'dia') {
        chave = `${anoStr}-${mesStr}-${diaStr}`;
      } else if (agrupamento_tempo === 'ano') {
        chave = anoStr;
      } else {
        // Padrão Mês
        chave = `${anoStr}-${mesStr}`;
      }

      if (!acc[chave]) {
        // Cria um objeto Date seguro (Meio-dia) para formatação visual
        const dataVisual = new Date(Number(anoStr), Number(mesStr) - 1, Number(diaStr), 12, 0, 0);

        acc[chave] = { 
          chave, 
          dataOrdenacao: dataVisual.getTime(),
          dataObj: dataVisual, 
          valor: 0,
          label: '' 
        };
        
        try {
            if (agrupamento_tempo === 'dia') acc[chave].label = format(dataVisual, 'dd/MMM', { locale: ptBR });
            else if (agrupamento_tempo === 'ano') acc[chave].label = format(dataVisual, 'yyyy');
            else acc[chave].label = format(dataVisual, 'MMM/yy', { locale: ptBR });
        } catch (err) {
            acc[chave].label = chave;
        }
      }

      // --- SOMA DE VALORES BLINDADA ---
      const valorItem = Number(item.valor || 0);
      
      if (tipoCalculo === 'receita_pura') {
          // Se o gráfico é SÓ receita, ignoramos despesas que podem ter vindo por erro de filtro
          if (item.tipo === 'Receita') acc[chave].valor += valorItem;
      } else if (tipoCalculo === 'despesa_pura') {
          // Se o gráfico é SÓ despesa, ignoramos receitas
          if (item.tipo === 'Despesa') acc[chave].valor += valorItem; 
      } else {
          // Modo Saldo (Mistura tudo)
          if (item.tipo === 'Despesa') acc[chave].valor -= valorItem;
          else acc[chave].valor += valorItem;
      }
      
      return acc;
    }, {});

    const arrayOrdenado = Object.values(agrupado).sort((a, b) => a.dataOrdenacao - b.dataOrdenacao);

    // Encontrar hoje para posicionar scroll
    const hoje = new Date();
    let idx = arrayOrdenado.findIndex(d => {
        if (agrupamento_tempo === 'dia') return isSameDay(d.dataObj, hoje);
        if (agrupamento_tempo === 'ano') return isSameYear(d.dataObj, hoje);
        return isSameMonth(d.dataObj, hoje);
    });

    if (idx === -1) {
        idx = arrayOrdenado.findIndex(d => d.dataOrdenacao > hoje.getTime());
        if (idx === -1 && arrayOrdenado.length > 0) idx = arrayOrdenado.length - 1;
        if (idx === -1 && arrayOrdenado.length > 0) idx = 0;
    }

    return { dadosFormatados: arrayOrdenado, indexAtual: idx, resumoTipo: labelLegenda };

  }, [dadosBrutos, agrupamento_tempo, filtros]);

  // --- 3. SCROLL ---
  useEffect(() => {
    if (scrollContainerRef.current && dadosFormatados.length > 0) {
        const containerVisibleWidth = scrollContainerRef.current.clientWidth;
        const totalContentWidth = Math.max(containerVisibleWidth, dadosFormatados.length * LARGURA_ITEM_PX);
        setChartWidth(totalContentWidth);

        if (indexAtual !== -1) {
            setTimeout(() => {
                if(!scrollContainerRef.current) return;
                const scrollPos = (indexAtual * LARGURA_ITEM_PX) - (containerVisibleWidth / 2) + (LARGURA_ITEM_PX / 2);
                scrollContainerRef.current.scrollTo({ left: Math.max(0, scrollPos), behavior: 'smooth' });
            }, 500);
        }
    }
  }, [dadosFormatados, indexAtual]);

  // --- RENDERIZAÇÃO ---
  if (isLoading) return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[250px] flex flex-col items-center justify-center text-gray-400">
      <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" />
      <span className="text-xs">Carregando dados...</span>
    </div>
  );

  if (error) return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 h-[250px] flex flex-col items-center justify-center text-red-400">
      <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2" />
      <span className="text-xs">Erro ao carregar</span>
    </div>
  );

  const corGrafico = kpi.filtros?._meta_visual?.cor || '#3B82F6';

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-full min-h-[250px] flex flex-col relative group hover:shadow-md transition-all">
      
      <div className="flex justify-between items-start mb-2 px-1">
        <div>
          <h3 className="text-sm font-bold text-gray-700">{kpi.titulo}</h3>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <span>{agrupamento_tempo === 'mes' ? 'Mensal' : agrupamento_tempo === 'dia' ? 'Diário' : 'Anual'}</span>
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium border border-gray-200">
                {resumoTipo}
            </span>
          </div>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><FontAwesomeIcon icon={faPen} className="text-xs" /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><FontAwesomeIcon icon={faTrash} className="text-xs" /></button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 w-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-2">
        <div style={{ width: chartWidth, height: '100%', minHeight: '180px', position: 'relative' }}>
            {isMounted && dadosFormatados.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                {tipo_visualizacao === 'grafico_barra' ? (
                  <BarChart data={dadosFormatados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} />
                    <Tooltip 
                        cursor={{fill: '#F3F4F6'}} 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                        formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoTipo]} 
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={30}>
                        {dadosFormatados.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === indexAtual ? '#F59E0B' : corGrafico} />
                        ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={dadosFormatados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`color-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={corGrafico} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={corGrafico} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} />
                    <Tooltip 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                        formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoTipo]} 
                    />
                    {indexAtual !== -1 && <ReferenceLine x={dadosFormatados[indexAtual].label} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'top', value: 'Hoje', fill: '#F59E0B', fontSize: 10 }} />}
                    <Area type="monotone" dataKey="valor" stroke={corGrafico} strokeWidth={2} fillOpacity={1} fill={`url(#color-${kpi.id})`} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 text-xs italic">
                <p>Sem dados para este filtro</p>
                <p className="text-[10px] mt-1 opacity-70">Verifique filtros de tipo e datas</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
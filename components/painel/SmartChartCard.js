"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
// Certifique-se de ter instalado: npm install recharts
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

  useEffect(() => { setIsMounted(true); }, []);

  // --- 1. BUSCA DE DADOS VIA RPC (O SEGREDO DA SOMA CORRETA) ---
  const { data: dadosBrutos = [], isLoading, error } = useQuery({
    queryKey: ['chart_data_v6', kpi?.id, filtros, user?.organizacao_id],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];

      // Prepara os filtros para o formato que o SQL espera
      const filtrosNormalizados = {
          startDate: filtros.startDate || filtros.data_inicio || null,
          endDate: filtros.endDate || filtros.data_fim || null,
          
          status: Array.isArray(filtros.status) 
            ? filtros.status.filter(s => s !== 'todos') 
            : (filtros.status === 'todos' ? [] : [filtros.status].filter(Boolean)),
            
          tipo: Array.isArray(filtros.tipo) 
            ? filtros.tipo 
            : (filtros.tipo === 'todos' ? [] : [filtros.tipo].filter(Boolean)),
          
          categoriaIds: Array.isArray(filtros.categoriaIds) ? filtros.categoriaIds : (Array.isArray(filtros.categorias) ? filtros.categorias.map(c => c?.id || c) : []),
          contaIds: Array.isArray(filtros.contaIds) ? filtros.contaIds : (Array.isArray(filtros.contas) ? filtros.contas.map(c => c?.id || c) : []),
          empresaIds: Array.isArray(filtros.empresaIds) ? filtros.empresaIds : (Array.isArray(filtros.empresas) ? filtros.empresas.map(c => c?.id || c) : []),
          empreendimentoIds: Array.isArray(filtros.empreendimentoIds) ? filtros.empreendimentoIds : (Array.isArray(filtros.empreendimentos) ? filtros.empreendimentos.map(c => c?.id || c) : []),
          
          ignoreTransfers: filtros.ignoreTransfers ?? true,
          ignoreChargebacks: filtros.ignoreChargebacks ?? true,
          useCompetencia: filtros.useCompetencia ?? false
      };

      // Limpeza
      if (!filtrosNormalizados.status[0]) delete filtrosNormalizados.status;
      if (!filtrosNormalizados.tipo[0]) delete filtrosNormalizados.tipo;

      // CHAMA A FUNÇÃO SQL QUE SABE FAZER RECURSÃO DE CATEGORIAS
      const { data, error } = await supabase.rpc('get_dados_grafico_kpi', {
        p_organizacao_id: user.organizacao_id,
        p_filtros: filtrosNormalizados
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.organizacao_id && !!kpi, 
    staleTime: 1000 * 60 * 5, 
  });

  // --- 2. INTELIGÊNCIA DE DADOS (Visualização) ---
  const { dadosFormatados, indexAtual, resumoTipo } = useMemo(() => {
    if (!dadosBrutos?.length) return { dadosFormatados: [], indexAtual: -1, resumoTipo: 'Misto' };

    const temReceita = dadosBrutos.some(d => d.tipo === 'Receita');
    const temDespesa = dadosBrutos.some(d => d.tipo === 'Despesa');
    
    let tipoCalculo = 'saldo'; 
    let labelLegenda = 'Saldo';
    const filtroTipo = Array.isArray(filtros.tipo) ? filtros.tipo[0] : filtros.tipo;

    if ((filtros.tipo && filtroTipo === 'Receita') || (temReceita && !temDespesa)) {
        tipoCalculo = 'receita_pura';
        labelLegenda = 'Receita';
    } else if ((filtros.tipo && filtroTipo === 'Despesa') || (!temReceita && temDespesa)) {
        tipoCalculo = 'despesa_pura';
        labelLegenda = 'Despesa';
    }

    const agrupado = dadosBrutos.reduce((acc, item) => {
      // Mesma lógica de data da lista
      let dataParaUso = item.data_transacao;
      
      if (filtros.useCompetencia) {
          dataParaUso = item.data_transacao;
      } else {
          if (item.data_pagamento) dataParaUso = item.data_pagamento;
          else if (item.data_vencimento) dataParaUso = item.data_vencimento;
      }

      if (!dataParaUso) return acc;

      const [anoStr, mesStr, diaStr] = dataParaUso.split('T')[0].split('-');
      
      let chave = '';
      if (agrupamento_tempo === 'dia') chave = `${anoStr}-${mesStr}-${diaStr}`;
      else if (agrupamento_tempo === 'ano') chave = anoStr;
      else chave = `${anoStr}-${mesStr}`;

      if (!acc[chave]) {
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
        } catch (err) { acc[chave].label = chave; }
      }

      const valorItem = Number(item.valor || 0);
      
      if (tipoCalculo === 'receita_pura') {
          if (item.tipo === 'Receita') acc[chave].valor += valorItem;
      } else if (tipoCalculo === 'despesa_pura') {
          if (item.tipo === 'Despesa') acc[chave].valor += valorItem; 
      } else {
          if (item.tipo === 'Despesa') acc[chave].valor -= valorItem;
          else acc[chave].valor += valorItem;
      }
      return acc;
    }, {});

    const arrayOrdenado = Object.values(agrupado).sort((a, b) => a.dataOrdenacao - b.dataOrdenacao);

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

  if (isLoading) return <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[250px] flex flex-col items-center justify-center text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2" /><span className="text-xs">Carregando dados...</span></div>;
  if (error) return <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 h-[250px] flex flex-col items-center justify-center text-red-400"><FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2" /><span className="text-xs">Erro ao carregar</span></div>;

  const corGrafico = kpi.filtros?._meta_visual?.cor || '#3B82F6';

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 h-full min-h-[250px] flex flex-col relative group hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-2 px-1">
        <div>
          <h3 className="text-sm font-bold text-gray-700">{kpi.titulo}</h3>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><span>{agrupamento_tempo === 'mes' ? 'Mensal' : agrupamento_tempo === 'dia' ? 'Diário' : 'Anual'}</span></p>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium border border-gray-200">{resumoTipo}</span>
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
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoTipo]} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={30}> {dadosFormatados.map((entry, index) => ( <Cell key={`cell-${index}`} fill={index === indexAtual ? '#F59E0B' : corGrafico} /> ))} </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={dadosFormatados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs> <linearGradient id={`color-${kpi.id}`} x1="0" y1="0" x2="0" y2="1"> <stop offset="5%" stopColor={corGrafico} stopOpacity={0.2}/> <stop offset="95%" stopColor={corGrafico} stopOpacity={0}/> </linearGradient> </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} />
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, resumoTipo]} />
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
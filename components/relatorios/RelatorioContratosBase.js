"use client";

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileContract, faFilter, faCalendarAlt, faBuilding, faCheck } from '@fortawesome/free-solid-svg-icons';
import TabelaRelatorioContratos from './TabelaRelatorioContratos';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function RelatorioContratosBase() {
  const supabase = createClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const [selectedEmpreendimentos, setSelectedEmpreendimentos] = useState([]);
  const [selectedMonthYear, setSelectedMonthYear] = useState('');

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['relatorio_contratos', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];

      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero_contrato,
          data_venda,
          valor_final_venda,
          status_contrato,
          tipo_documento,
          contato:contato_id ( id, nome, razao_social ),
          produtos:contrato_produtos (
            produto:produto_id ( unidade, tipo )
          ),
          empreendimento:empreendimento_id ( id, nome ),
          lancamentos ( id, valor, status, tipo, data_vencimento, data_pagamento )
        `)
        .eq('organizacao_id', organizacaoId)
        .eq('tipo_documento', 'CONTRATO')
        .eq('lixeira', false); // Trava antifantasmas: não trazer nada deletado

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizacaoId
  });

  const empreendimentosDisponiveis = useMemo(() => {
    const map = new Map();
    rawData.forEach(c => {
      if (c.empreendimento?.id) {
        map.set(c.empreendimento.id, c.empreendimento.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a,b) => a.nome.localeCompare(b.nome));
  }, [rawData]);

  const toggleEmpreendimento = (id) => {
    setSelectedEmpreendimentos(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const dadosProcessados = useMemo(() => {
    let filtrados = rawData;
    
    if (selectedEmpreendimentos.length > 0) {
      filtrados = filtrados.filter(c => c.empreendimento?.id && selectedEmpreendimentos.includes(c.empreendimento.id));
    }

    return filtrados.map(contrato => {
      let valorPago = 0;
      let valorRecebidoNoMes = 0;

      contrato.lancamentos?.forEach(l => {
        if ((l.status === 'Pago' || l.status === 'Conciliado') && l.tipo === 'Receita') {
          const val = Number(l.valor) || 0;
          valorPago += val;

          if (selectedMonthYear) {
            // Priorizamos data_pagamento (se já pagou, quando foi?). Se falhar em antigos, caimos pro vencimento
            const dataCheck = l.data_pagamento || l.data_vencimento;
            if (dataCheck && dataCheck.startsWith(selectedMonthYear)) {
              valorRecebidoNoMes += val;
            }
          }
        }
      });

      const valorTotal = Number(contrato.valor_final_venda) || 0;
      const saldoAPagar = Math.max(0, valorTotal - valorPago);
      const progresso = valorTotal > 0 ? (valorPago / valorTotal) * 100 : 0;

      let statusBadge = "Em Dia";
      let colorBadge = "bg-green-100 text-green-800";

      if (Math.round(progresso) >= 100) {
        statusBadge = "Quitado";
        colorBadge = "bg-purple-100 text-purple-800";
      } else {
        const hoje = new Date().toISOString().split('T')[0];
        const temAtraso = contrato.lancamentos?.some(l =>
          (l.status === 'Atrasado' || (l.status === 'Pendente' && l.data_vencimento < hoje))
          && l.tipo === 'Receita'
        );

        if (temAtraso) {
          statusBadge = "Inadimplente";
          colorBadge = "bg-red-100 text-red-800";
        }
      }

      const nomesUnidades = contrato.produtos?.map(p => p.produto?.unidade).filter(Boolean).join(', ');

      return {
        ...contrato,
        valorPago,
        valorRecebidoNoMes,
        saldoAPagar,
        progresso,
        statusBadge,
        colorBadge,
        unidadesDisplay: nomesUnidades || 'Não especificada'
      };
    });
  }, [rawData, selectedEmpreendimentos, selectedMonthYear]);

  const totalVendido = dadosProcessados.reduce((acc, c) => acc + (Number(c.valor_final_venda) || 0), 0);
  const totalRecebido = dadosProcessados.reduce((acc, c) => acc + c.valorPago, 0);
  const totalRecebidoNoMes = dadosProcessados.reduce((acc, c) => acc + c.valorRecebidoNoMes, 0);
  const totalAReceber = dadosProcessados.reduce((acc, c) => acc + c.saldoAPagar, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 text-blue-600">
        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
            <FontAwesomeIcon icon={faFileContract} className="text-blue-600" />
            Relatório de Contratos
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhamento de fluxo de caixa e andamento financeiro dos contratos ativos.
          </p>
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row gap-6">
        {/* Empreendimentos */}
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faBuilding} /> Empreendimentos (Multiseleção)
          </label>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedEmpreendimentos([])}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${selectedEmpreendimentos.length === 0 ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            >
              Todos
            </button>
            {empreendimentosDisponiveis.map(emp => {
              const isSelected = selectedEmpreendimentos.includes(emp.id);
              return (
                <button 
                  key={emp.id}
                  onClick={() => toggleEmpreendimento(emp.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${isSelected ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
                >
                  {isSelected && <FontAwesomeIcon icon={faCheck} size="sm" />} {emp.nome}
                </button>
              );
            })}
          </div>
        </div>

        {/* Período */}
        <div className="xl:w-64">
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarAlt} /> Período de Recebimento
          </label>
          <input 
            type="month"
            value={selectedMonthYear}
            onChange={(e) => setSelectedMonthYear(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all cursor-pointer hover:bg-gray-50"
          />
          {selectedMonthYear && (
             <button onClick={() => setSelectedMonthYear('')} className="mt-2 ml-1 text-[11px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider">
               ✕ Limpar Período
             </button>
          )}
        </div>
      </div>

      {/* CARDS TOTAIS */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedMonthYear ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4`}>
        <div className="bg-white border-l-4 border-gray-400 rounded-xl shadow-sm p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">VGV Contratado (Ativo)</div>
          <div className="text-2xl font-black text-gray-800">{formatCurrency(totalVendido)}</div>
        </div>

        {selectedMonthYear && (
          <div className="bg-white border-l-4 border-blue-500 rounded-xl shadow-sm p-5 relative overflow-hidden transform scale-100 animate-fade-in group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
               <FontAwesomeIcon icon={faCalendarAlt} className="text-6xl text-blue-900" />
             </div>
             <div className="text-xs font-bold text-blue-500/80 uppercase tracking-widest mb-1 flex items-center gap-2">
               Recebido no Mês
             </div>
             <div className="text-2xl font-black text-blue-600 relative z-10">{formatCurrency(totalRecebidoNoMes)}</div>
             <div className="text-[10px] text-blue-500 font-bold mt-1 uppercase">Apenas Receitas do período filtrado</div>
          </div>
        )}

        <div className="bg-white border-l-4 border-green-500 rounded-xl shadow-sm p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Já Recebido</div>
          <div className="text-2xl font-black text-green-700">{formatCurrency(totalRecebido)}</div>
          <div className="text-[10px] text-green-600 font-bold mt-1 uppercase">Histórico Global da Venda</div>
        </div>
        
        <div className="bg-white border-l-4 border-red-400 rounded-xl shadow-sm p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">A Receber (Inadimp/Futuro)</div>
          <div className="text-2xl font-black text-red-500">{formatCurrency(totalAReceber)}</div>
          <div className="text-[10px] text-red-500 font-bold mt-1 uppercase">Volume financeiro pendente</div>
        </div>
      </div>

      {/* TABELA DE DADOS */}
      <TabelaRelatorioContratos contratos={dadosProcessados} periodoFiltro={selectedMonthYear} />
    </div>
  );
}

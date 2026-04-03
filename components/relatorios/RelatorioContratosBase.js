"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileContract } from '@fortawesome/free-solid-svg-icons';
import TabelaRelatorioContratos from './TabelaRelatorioContratos';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function RelatorioContratosBase() {
 const supabase = createClient();
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const { data: rawData = [], isLoading } = useQuery({
 queryKey: ['relatorio_contratos', organizacaoId],
 queryFn: async () => {
 if (!organizacaoId) return [];

 // Puxamos todos os contratos que NÃO são "Termo de Interesse"
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
 empreendimento:empreendimento_id ( nome ),
 lancamentos ( id, valor, status, tipo, data_vencimento )
 `)
 .eq('organizacao_id', organizacaoId)
 .eq('tipo_documento', 'CONTRATO');

 if (error) throw error;
 return data || [];
 },
 enabled: !!organizacaoId
 });

 // Processar os dados para cálculo das colunas gerenciais
 const dadosProcessados = useMemo(() => {
 return rawData.map(contrato => {
 // Conta Tudo que foi Pago e Conciliado (Apenas Receitas para somar pagamentos do cliente)
 const valorPago = contrato.lancamentos?.reduce((acc, l) => {
 if ((l.status === 'Pago' || l.status === 'Conciliado') && l.tipo === 'Receita') {
 return acc + (Number(l.valor) || 0);
 }
 return acc;
 }, 0) || 0;

 const valorTotal = Number(contrato.valor_final_venda) || 0;
 const saldoAPagar = Math.max(0, valorTotal - valorPago);
 const progresso = valorTotal > 0 ? (valorPago / valorTotal) * 100 : 0;

 // Determinar o Status Visual do contrato baseado nos lançamentos ou no saldo
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

 // Exibir as unidades formatadas
 const nomesUnidades = contrato.produtos?.map(p => p.produto?.unidade).filter(Boolean).join(', ');

 return {
 ...contrato,
 valorPago,
 saldoAPagar,
 progresso,
 statusBadge,
 colorBadge,
 unidadesDisplay: nomesUnidades || 'Não especificada'
 };
 });
 }, [rawData]);

 // Calcular totais gerais para os Cards
 const totalVendido = dadosProcessados.reduce((acc, c) => acc + (Number(c.valor_final_venda) || 0), 0);
 const totalRecebido = dadosProcessados.reduce((acc, c) => acc + c.valorPago, 0);
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

 {/* CARDS TOTAIS */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-white border-l-4 border-blue-500 rounded-xl shadow-sm p-6">
 <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">VGV Contratado (Ativo)</div>
 <div className="text-3xl font-black text-gray-800">{formatCurrency(totalVendido)}</div>
 </div>
 <div className="bg-white border-l-4 border-green-500 rounded-xl shadow-sm p-6">
 <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Já Recebido</div>
 <div className="text-3xl font-black text-green-700">{formatCurrency(totalRecebido)}</div>
 <div className="text-xs text-green-600 font-medium mt-1">Baseado nos Lançamentos Pagos</div>
 </div>
 <div className="bg-white border-l-4 border-blue-600 rounded-xl shadow-sm p-6">
 <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo Devedor / A Receber</div>
 <div className="text-3xl font-black text-blue-600">{formatCurrency(totalAReceber)}</div>
 <div className="text-xs text-blue-600 font-medium mt-1">Volume financeiro pendente</div>
 </div>
 </div>

 {/* TABELA DE DADOS */}
 <TabelaRelatorioContratos contratos={dadosProcessados} />
 </div>
 );
}

// components/SimuladorPrintView.js
"use client";

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SimuladorPrintView = React.forwardRef(({ simulacao, produtos, empreendimento, contato, corretor, planoProposta, resumo }, ref) => {

 if (!simulacao || !resumo) return null;

 const logoUrl = empreendimento?.logo_url || empreendimento?.proprietaria?.logo_url || '/marca/logo-elo57-horizontal.svg';

 const formatCurrency = (value) => {
 if (typeof value !== 'number' && isNaN(parseFloat(value))) return 'R$ 0,00';
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value) || 0);
 };

 return (
 <div ref={ref} className="print-view p-8 bg-white text-gray-800 font-sans text-[11px]">

 {/* ── Cabeçalho ─────────────────────────────────── */}
 <header className="flex justify-between items-center border-b-2 pb-4 mb-6">
 <div className="text-left">
 <img src={logoUrl} alt={`Logo ${empreendimento?.nome || 'Empresa'}`} className="h-10 object-contain" />
 <p className="text-xs mt-2">CNPJ: 41.464.589/0001-66</p>
 <p className="text-xs">Av. Rio Doce, 1825 - Ilha dos Araújos</p>
 <p className="text-xs">Governador Valadares, MG - CEP: 35020-500</p>
 </div>
 <div className="text-right">
 <h1 className="text-xl font-bold text-gray-700">Proposta de Compra</h1>
 <p className="text-xs mt-2">Data: {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
 <p className="text-xs">Proposta Nº: {simulacao.id}</p>
 </div>
 </header>

 <main>

 {/* ── Proponente e Corretor ─────────────────── */}
 <section className="mb-5">
 <h2 className="text-sm font-semibold border-b pb-1 mb-2">Proponente e Corretor</h2>
 <div className="grid grid-cols-2 gap-x-8 gap-y-1">
 <div><strong>Proponente:</strong> {contato?.nome || 'N/A'}</div>
 <div><strong>Corretor:</strong> {corretor?.nome || 'N/A'}</div>
 <div><strong>Telefone:</strong> {contato?.telefone || 'N/A'}</div>
 <div><strong>Telefone:</strong> {corretor?.telefone || 'N/A'}</div>
 </div>
 </section>

 {/* ── Detalhes do Imóvel ────────────────────── */}
        <section className="mb-5">
          <h2 className="text-sm font-semibold border-b pb-1 mb-2">Detalhes do Imóvel</h2>
          <div className="mb-2 text-xs">
            <strong>Empreendimento:</strong> {empreendimento?.nome || 'N/A'}
          </div>
          <div className="grid grid-cols-1 gap-1 border border-gray-100 rounded p-2 bg-gray-50">
             {produtos?.map((p, i) => (
                <div key={i} className="flex justify-between border-b border-gray-200 pb-1 mb-1 last:border-0 last:mb-0 last:pb-0">
                  <div><strong>{p.tipo} {p.unidade}</strong> ({parseFloat(p.area_m2 || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²)</div>
                  <div className="font-medium">{typeof p.valor_venda_calculado !== 'undefined' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor_venda_calculado) : 'R$ 0,00'}</div>
                </div>
             ))}
          </div>
        </section>

 {/* ── Resumo Financeiro ─────────────────────── */}
 <section className="mb-5">
 <h2 className="text-sm font-semibold border-b pb-1 mb-2">Resumo da Proposta Financeira</h2>
 <div className="bg-gray-50 p-3 rounded text-xs space-y-1.5">
 <div className="flex justify-between"><span>Valor Base Total:</span><span className="font-semibold">{formatCurrency(resumo.valorBase)}</span></div>
 <div className="flex justify-between text-green-700"><span>Desconto ({resumo.descontoPercentual?.toFixed(2)}%):</span><span className="font-semibold">- {formatCurrency(resumo.descontoValor)}</span></div>
 <div className="flex justify-between border-t pt-1.5 font-bold text-sm"><span>Valor Final da Proposta:</span><span>{formatCurrency(resumo.valorFinal)}</span></div>
 <hr className="my-1" />
 <div className="flex justify-between"><span>Entrada ({resumo.entradaPercentual?.toFixed(2)}%):</span><span className="font-semibold">{resumo.entradaNumParcelas}x de {formatCurrency(resumo.entradaValorParcela)}</span></div>
 <div className="flex justify-between"><span>Parcelas ({resumo.obraPercentual?.toFixed(2)}%):</span><span className="font-semibold">{resumo.obraNumParcelas}x de {formatCurrency(resumo.obraValorParcela)}</span></div>
 <div className="flex justify-between"><span>Intermediárias:</span><span className="font-semibold">{formatCurrency(resumo.totalIntermediarias)}</span></div>
 <div className="flex justify-between"><span>Saldo Remanescente ({resumo.saldoRemPercentual?.toFixed(2)}%):</span><span className="font-semibold">{formatCurrency(resumo.saldoRemanescente)}</span></div>
 </div>
 </section>

 {/* ── ⚠️ Avisos e Observações ───────────────────────── */}
        <section className="mb-5">
        <div className="border border-amber-300 bg-amber-50 rounded p-3 text-xs text-amber-900">
        <p className="font-bold mb-1">⚠️ AVISOS E CONDIÇÕES DO EMPREENDIMENTO</p>
        {empreendimento?.observacoes ? (
          <div className="whitespace-pre-wrap leading-relaxed">{empreendimento.observacoes}</div>
        ) : (
          <>
            <p>
            Os valores de correção apresentados neste documento são uma <strong>projeção estimada</strong> com base
            no acumulado dos últimos 12 meses do índice INCC, acrescido de 11% ao ano conforme
            cláusula contratual. O INCC é divulgado mensalmente pela Fundação Getulio Vargas (FGV)
            e <strong>pode variar significativamente</strong> ao longo do tempo.
            </p>
            <p className="mt-1">
            Em caso de INCC negativo no período, a correção mínima aplicada será de <strong>11% ao ano</strong>.
            Os valores reais das parcelas futuras serão recalculados anualmente na data de aniversário
            do contrato, podendo diferir dos valores projetados nesta simulação.
            </p>
            <p className="mt-1 font-semibold">
            Esta simulação não constitui proposta firme de contrato. Os valores definitivos serão
            estabelecidos no instrumento contratual assinado pelas partes.
            </p>
          </>
        )}
        </div>
        </section>

 {/* ── Cronograma Detalhado ──────────────────── */}
 <section>
 <h2 className="text-sm font-semibold border-b pb-1 mb-2">Cronograma Detalhado de Pagamentos</h2>
 <table className="w-full text-xs text-left border-collapse">
 <thead className="bg-gray-100">
 <tr>
 <th className="p-1.5 border border-gray-200 text-left">Descrição</th>
 <th className="p-1.5 border border-gray-200 text-center">Vencimento</th>
 <th className="p-1.5 border border-gray-200 text-right">Valor (R$)</th>
 <th className="p-1.5 border border-gray-200 text-right">Saldo Devedor</th>
 <th className="p-1.5 border border-gray-200 text-right">Correção Aplicada</th>
 </tr>
 </thead>
 <tbody>
 {planoProposta.map((parcela, index) => (
 <tr
 key={index}
 className={parcela.correcao_aplicada > 0 ? 'bg-amber-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}
 >
 <td className="p-1.5 border border-gray-200">
 {parcela.correcao_aplicada > 0 ? (
 <span className="font-semibold text-amber-800">★ {parcela.descricao}</span>
 ) : parcela.descricao}
 </td>
 <td className="p-1.5 border border-gray-200 text-center">{parcela.vencimento}</td>
 <td className={`p-1.5 border border-gray-200 text-right font-semibold ${parcela.correcao_aplicada > 0 ? 'text-amber-700' : ''}`}>
 {parcela.valor}
 </td>
 <td className="p-1.5 border border-gray-200 text-right text-gray-500">
 {parcela.saldo_devedor || '—'}
 </td>
 <td className="p-1.5 border border-gray-200 text-right">
 {parcela.correcao_aplicada > 0 ? (
 <span className="font-bold text-red-700">+ {parcela.correcao_texto}</span>
 ) : (
 <span className="text-gray-300">—</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <p className="text-[10px] text-gray-500 mt-1">
 ★ Linhas destacadas = mês de aniversário do contrato com correção anual aplicada (INCC + 11% a.a.)
 </p>
 </section>

 {/* ── Assinaturas ───────────────────────────── */}
 <section className="mt-10 text-xs">
 <div className="mt-12 grid grid-cols-2 gap-16 text-center">
 <div>
 <p className="border-t pt-2">Assinatura do Proponente</p>
 <p className="mt-1">{contato?.nome || contato?.razao_social}</p>
 </div>
 <div>
 <p className="border-t pt-2">Assinatura do Corretor</p>
 <p className="mt-1">{corretor?.nome || 'N/A'}</p>
 </div>
 </div>
 </section>

 </main>

 <footer className="text-center text-[10px] text-gray-400 mt-8 pt-3 border-t">
 Elo 57 — Excelência em cada detalhe. | Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
 </footer>
 </div>
 );
});

SimuladorPrintView.displayName = 'SimuladorPrintView';

export default SimuladorPrintView;
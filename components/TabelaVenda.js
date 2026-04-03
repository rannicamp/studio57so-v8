// components/TabelaVenda.js

"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faImage, faExclamationCircle, faPen, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';

// Função para formatar números como moeda brasileira (BRL)
const formatCurrency = (value) => {
 if (value == null || isNaN(value)) return 'R$ 0,00';
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function TabelaVenda({ produtos, config, parcelasAdicionais, empreendimento }) {
 const supabase = createClient();
 const queryClient = useQueryClient();

 const [isEditingObs, setIsEditingObs] = useState(false);
 const defaultObs = '*Correção mensal pelo INCC até a entrega das chaves, após entrega IGP-M + 1% a.m.\n**Sujeito a alteração sem aviso prévio.';
 const [obsText, setObsText] = useState(empreendimento?.observacoes || defaultObs);

 const updateObsMutation = useMutation({
 mutationFn: async (newObs) => {
 const { error } = await supabase
 .from('empreendimentos')
 .update({ observacoes: newObs })
 .eq('id', empreendimento?.id);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Termos e Condições atualizados!');
 queryClient.invalidateQueries(['empreendimento', empreendimento?.id]);
 },
 onError: (error) => {
 toast.error('Erro ao salvar termos: ' + error.message);
 }
 });

 const handleSaveObs = () => {
 updateObsMutation.mutate(obsText);
 setIsEditingObs(false);
 }; const TabelaCalculada = useMemo(() => {
 if (!produtos || produtos.length === 0 || !config) return [];
 return produtos.map(produto => {
 const valorVenda = parseFloat(produto.valor_venda_calculado) || 0;
 const desconto = parseFloat(config.desconto_percentual) || 0;
 const valorComDesconto = valorVenda * (1 - desconto / 100);
 const entradaPct = parseFloat(config.entrada_percentual) || 0;
 const obraPct = parseFloat(config.parcelas_obra_percentual) || 0;
 const remanescentePct = parseFloat(config.saldo_remanescente_percentual) || 0;
 const totalEntrada = valorComDesconto * (entradaPct / 100);
 const totalObra = valorComDesconto * (obraPct / 100);
 const totalRemanescente = valorComDesconto * (remanescentePct / 100);
 const numParcelasEntrada = parseInt(config.num_parcelas_entrada) || 1;
 const valorParcelaEntrada = numParcelasEntrada > 0 ? totalEntrada / numParcelasEntrada : 0;
 const numParcelasObra = parseInt(config.num_parcelas_obra) || 1;
 const valorParcelaObra = numParcelasObra > 0 ? totalObra / numParcelasObra : 0;
 return {
 ...produto, valorFinal: valorComDesconto, totalEntrada, totalObra, totalRemanescente,
 numParcelasEntrada, valorParcelaEntrada, numParcelasObra, valorParcelaObra
 };
 });
 }, [produtos, config]);

 const numColunasEntrada = useMemo(() => Math.max(0, parseInt(config?.num_parcelas_entrada) || 0), [config]);

 const getStatusClass = (status) => {
 if (!status) return 'row-disponivel';
 const s = status.toString().trim().toLowerCase();
 if (s === 'vendido') return 'row-vendido';
 if (s === 'reservado') return 'row-reservado';
 return 'row-disponivel';
 };

 return (
 <div className="printable-content-area s57-print-area bg-white rounded-lg shadow p-6 mt-8">
 <style jsx global>{`
 /* ==========================================================================
 ESTILOS DA TELA (VISUALIZAÇÃO NORMAL)
 ========================================================================== */
 .sales-table { width: 100%; border-collapse: collapse; }
 .sales-table th, .sales-table td { border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; padding: 10px; }
 .sales-table thead { background-color: #f8f9fa; }
 .sales-table th { font-weight: 600; color: #343a40; }
 .sales-table .group-header { background-color: #e9ecef; }
 .number { text-align: right; }
 /* Controle de tamanho das Logos na TELA */
 .print-header {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-bottom: 20px;
 border-bottom: 1px solid #eee;
 padding-bottom: 15px;
 }
 .print-header img {
 height: 50px; width: auto;
 object-fit: contain;
 }
 /* CORES DEFINIDAS AQUI */
 .row-disponivel { background-color: #ffffff; }
 .row-reservado { background-color: #fff3cd !important; color: #856404; } /* Amarelo */
 .row-vendido { background-color: #f8d7da !important; color: #721c24; } /* Vermelho */
 /* RODAPÉ E OBSERVAÇÕES */
 .print-footer {
 width: 100%;
 margin-top: 10px;
 padding-top: 5px;
 border-top: 1px solid #333;
 text-align: center;
 font-size: 0.8rem;
 color: #555;
 }
 /* Preserva quebras de linha nas observações */
 .observacoes-texto {
 white-space: pre-wrap; text-align: center;
 }

 /* ==========================================================================
 ESTILOS DE IMPRESSÃO (PDF)
 ========================================================================== */
 @media print {
 @page {
 size: landscape;
 margin: 10mm;
 }

 /* VACINA ANTI-PÁGINA BRANCA: Derrubar os limites de Altura e Overflow do Next.js/React */
 html, body, main, div {
 height: auto !important;
 min-height: auto !important;
 max-height: none !important;
 overflow: visible !important;
 box-shadow: none !important;
 }

 body {
 -webkit-print-color-adjust: exact !important;
 print-color-adjust: exact !important;
 visibility: hidden; /* Esconde o gerador principal */
 margin: 0 !important;
 padding: 0 !important;
 background: none !important;
 }

 .no-print {
 display: none !important;
 }

 /* Força apenas a Área de Impressão ser visível e ficar absoluta no topo! */
 .printable-content-area {
 position: absolute;
 left: 0;
 top: 0;
 width: 100%;
 visibility: visible;
 padding: 0 !important;
 margin: 0 !important;
 border: none !important;
 font-size: 8pt;
 }
 .printable-content-area * {
 visibility: visible;
 }

 .sales-table {
 width: 100%;
 border-collapse: collapse;
 table-layout: auto;
 }
 .sales-table th, .sales-table td {
 border: 1px solid #333 !important;
 padding: 4px;
 text-align: center;
 vertical-align: middle;
 white-space: normal;
 word-break: break-word;
 line-height: 1.2;
 }
 .sales-table th {
 background-color: #f2f2f2 !important;
 font-weight: bold;
 }
 .sales-table td.number {
 white-space: nowrap;
 }
 .sales-table tbody tr {
 page-break-inside: avoid !important;
 }

 .print-header {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-bottom: 15px;
 border-bottom: 2px solid #eee;
 padding-bottom: 10px;
 }
 /* AQUI MANTEMOS O TAMANHO PEQUENO PARA O PDF */
 .print-header img {
 height: 35px; /* Tamanho reduzido para impressão */
 width: auto;
 object-fit: contain;
 display: block; }
 .print-footer {
 width: 100%;
 margin-top: 10px;
 padding-top: 5px;
 border-top: 1px solid #333;
 text-align: center;
 font-size: 7pt;
 }
 .print-footer .legend {
 display: flex;
 justify-content: center;
 gap: 15px;
 margin-bottom: 5px;
 }
 .print-footer .legend span {
 display: inline-block;
 width: 12px;
 height: 12px;
 border: 1px solid #333;
 vertical-align: middle;
 margin-right: 4px;
 }
 }
 `}</style>

 <div className="flex justify-between items-center mb-6 no-print">
 <div className="flex items-center gap-3">
 <h2 className="text-2xl font-bold text-gray-900">Tabela de Venda</h2>
 </div>

 <button
 onClick={() => window.print()}
 className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center transition-colors duration-200"
 >
 <FontAwesomeIcon icon={faPrint} className="mr-2" />
 Imprimir / Salvar PDF
 </button>
 </div>

 <div>
 {/* CABEÇALHO DINÂMICO PARA IMPRESSÃO */}
 <div className="print-header">
 {/* Logo da Empresa Proprietária (Esquerda) */}
 <div className="w-1/3 flex justify-start">
 {empreendimento?.proprietaria?.logo_url ? (
 <img
 src={empreendimento.proprietaria.logo_url}
 alt="Logo da Empresa Proprietária"
 className="h-10 object-contain"
 crossOrigin="anonymous"
 />
 ) : (
 <img
 src="/marca/logo-elo57-horizontal.svg"
 alt="Logo Elo 57"
 className="h-10 object-contain"
 />
 )}
 </div>

 {/* Título Centralizado */}
 <div className="w-1/3 flex justify-center items-center">
 <h2 className="text-xl font-bold text-gray-800 text-center uppercase">
 Tabela de Vendas - {empreendimento?.nome}
 </h2>
 </div>

 {/* Logo do Empreendimento (Dinâmica à direita) */}
 <div className="w-1/3 flex justify-end">
 {empreendimento?.logo_url ? (
 <img
 src={empreendimento.logo_url}
 alt={`Logo ${empreendimento.nome}`}
 crossOrigin="anonymous"
 />
 ) : (
 // Se não tiver logo, mostra o nome
 <div className="flex flex-col items-end justify-center h-8">
 <span className="text-lg font-bold text-gray-800 uppercase">{empreendimento?.nome}</span>
 </div>
 )}
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="sales-table">
 <thead>
 <tr>
 <th rowSpan="2">Unidade</th>
 <th rowSpan="2">Tipo</th>
 <th rowSpan="2">Área (m²)</th>
 <th rowSpan="2">Valor (R$)</th>
 <th colSpan={numColunasEntrada + 1} className="group-header">Entrada ({config.entrada_percentual || 0}%)</th>
 {parcelasAdicionais.map((p, i) =>
 <th key={`adicional-header-${i}`} rowSpan="2">Intermediária<br />{new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</th>
 )}
 <th colSpan="2" className="group-header">Parcelas Obra ({config.parcelas_obra_percentual || 0}%)</th>
 <th rowSpan="2">Remanescente ({config.saldo_remanescente_percentual || 0}%) (R$)</th>
 </tr>
 <tr>
 {Array.from({ length: numColunasEntrada }).map((_, i) => (
 <th key={`entrada-sub-${i}`} className="sub-header">Parcela {i + 1} (R$)</th>
 ))}
 <th className="sub-header">Total Entrada (R$)</th>
 <th className="sub-header">Qtde.</th>
 <th className="sub-header">Valor Parcela (R$)</th>
 </tr>
 </thead>
 <tbody>
 {TabelaCalculada.map(item => (
 <tr key={item.id} className={getStatusClass(item.status)}>
 <td>{item.unidade}</td>
 <td>{item.tipo}</td>
 <td className="number">{Number(item.area_m2).toFixed(2)}</td>
 <td className="number font-semibold">{formatCurrency(item.valorFinal)}</td>
 {Array.from({ length: numColunasEntrada }).map((_, i) => (
 <td key={`entrada-val-${i}-${item.id}`} className="number">{formatCurrency(item.valorParcelaEntrada)}</td>
 ))}
 <td className="number font-bold">{formatCurrency(item.totalEntrada)}</td>
 {parcelasAdicionais.map((p, i) => <td key={`adicional-val-${i}-${item.id}`} className="number">{formatCurrency(p.valor)}</td>)}
 <td>{item.numParcelasObra}</td>
 <td className="number">{formatCurrency(item.valorParcelaObra)}</td>
 <td className="number font-semibold">{formatCurrency(item.totalRemanescente)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="print-footer">
 <div className="legend">
 <div><span style={{ backgroundColor: '#ffffff' }}></span> Disponível</div>
 <div><span style={{ backgroundColor: '#fff3cd' }}></span> Reservado</div>
 <div><span style={{ backgroundColor: '#f8d7da' }}></span> Vendido</div>
 </div>

 {/* AQUI ESTÁ A OBSERVAÇÃO DINÂMICA, AGORA EDITÁVEL */}
 <div className="mt-4 relative group">
 {isEditingObs ? (
 <div className="flex flex-col items-center gap-3 no-print bg-gray-50/50 p-4 border border-blue-100 rounded-xl shadow-inner mt-4">
 <p className="text-xs font-bold text-gray-500 uppercase">Editando Termos e Condições (Rodapé)</p>
 <textarea
 className="w-full max-w-3xl p-3 border border-blue-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-gray-700 font-medium"
 rows={4}
 value={obsText}
 onChange={(e) => setObsText(e.target.value)}
 placeholder="Digite os Termos e Condições desta tabela..."
 />
 <div className="flex gap-2">
 <button onClick={handleSaveObs} className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all active:scale-95">
 <FontAwesomeIcon icon={faCheck} /> Salvar Termos
 </button>
 <button onClick={() => { setIsEditingObs(false); setObsText(empreendimento?.observacoes || defaultObs); }} className="bg-gray-400 hover:bg-gray-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-all active:scale-95">
 <FontAwesomeIcon icon={faTimes} /> Cancelar
 </button>
 </div>
 </div>
 ) : (
 <div className="relative inline-block w-full text-center py-2 px-8 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg transition-all">
 <p className="observacoes-texto text-sm text-gray-600">
 {obsText}
 </p>
 <button onClick={() => setIsEditingObs(true)} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all p-2 rounded-full no-print opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-blue-100 focus:outline-none"
 title="Editar Termos e Condições"
 >
 <FontAwesomeIcon icon={faPen} />
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
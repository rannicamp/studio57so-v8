// components/TabelaVenda.js

"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';

// Função para formatar números como moeda brasileira (BRL)
const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function TabelaVenda({ produtos, config, parcelasAdicionais }) {

    const TabelaCalculada = useMemo(() => {
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

    // --- ATUALIZAÇÃO: Função robusta para definir a classe CSS ---
    // Isso resolve o problema se o status vier como "reservado", "Reservado " ou "RESERVADO"
    const getStatusClass = (status) => {
        if (!status) return 'row-disponivel';
        
        const s = status.toString().trim().toLowerCase();
        
        if (s === 'vendido') return 'row-vendido';
        if (s === 'reservado') return 'row-reservado'; // Identifica RESERVADO de qualquer jeito
        
        return 'row-disponivel';
    };

    return (
        <div className="printable-content-area bg-white rounded-lg shadow p-6 mt-8">
            <style jsx global>{`
                /* Estilos da tela normal */
                .sales-table { width: 100%; border-collapse: collapse; }
                .sales-table th, .sales-table td { border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; padding: 10px; }
                .sales-table thead { background-color: #f8f9fa; }
                .sales-table th { font-weight: 600; color: #343a40; }
                .sales-table .group-header { background-color: #e9ecef; }
                .number { text-align: right; }
                
                /* CORES DEFINIDAS AQUI */
                .row-disponivel { background-color: #ffffff; }
                .row-reservado { background-color: #fff3cd !important; color: #856404; } /* Amarelo */
                .row-vendido { background-color: #f8d7da !important; color: #721c24; }   /* Vermelho */

                /* --- CSS DE IMPRESSÃO --- */
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm;
                    }

                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden;
                    }

                    .printable-content-area, .printable-content-area * {
                        visibility: visible;
                    }
                    .printable-content-area .no-print {
                        display: none;
                    }

                    .printable-content-area {
                        position: absolute;
                        top: 10mm;
                        left: 10mm;
                        width: calc(100% - 20mm);
                        height: auto;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        font-size: 8pt;
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
                        margin-bottom: 10px;
                    }
                    .print-header img {
                        max-height: 35px;
                    }
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
                <h2 className="text-2xl font-bold text-gray-900">Tabela de Venda</h2>
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center transition-colors duration-200"
                >
                    <FontAwesomeIcon icon={faPrint} className="mr-2" />
                    Imprimir / Salvar PDF
                </button>
            </div>

            <div>
                <div className="print-header">
                    <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG" alt="Logo Studio 57" />
                    <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa//Logo%20-%20Residencial%20ALFA%20-%206.png" alt="Logo Residencial Alfa" />
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
                                    <th key={`adicional-header-${i}`} rowSpan="2">Intermediária<br/>{new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</th>
                                )}
                                <th colSpan="2" className="group-header">Parcelas Obra ({config.parcelas_obra_percentual || 0}%)</th>
                                <th rowSpan="2">Remanescente ({config.saldo_remanescente_percentual || 0}%) (R$)</th>
                            </tr>
                            <tr>
                                {Array.from({ length: numColunasEntrada }).map((_, i) => (
                                    <th key={`entrada-sub-${i}`} className="sub-header">Parcela {i+1} (R$)</th>
                                ))}
                                <th className="sub-header">Total Entrada (R$)</th>
                                <th className="sub-header">Qtde.</th>
                                <th className="sub-header">Valor Parcela (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {TabelaCalculada.map(item => (
                                // --- ATUALIZAÇÃO: Uso da função segura getStatusClass ---
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
                    <p>*Correção trimestral pelo INCC **1 vaga de estacionamento por unidade. Tabela sujeita a alterações sem aviso prévio.</p>
                </div>
            </div>
        </div>
    );
}
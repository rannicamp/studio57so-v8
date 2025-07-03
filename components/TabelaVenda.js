"use client";

import { useMemo } from 'react';

// Função para formatar números como moeda brasileira (BRL)
const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function TabelaVenda({ produtos, config, parcelasAdicionais }) {

    const TabelaCalculada = useMemo(() => {
        if (!produtos || produtos.length === 0 || !config) {
            return [];
        }

        return produtos.map(produto => {
            const valorVenda = parseFloat(produto.valor_venda_calculado) || 0;
            const desconto = parseFloat(config.desconto_percentual) || 0;
            const valorComDesconto = valorVenda * (1 - desconto / 100);

            // Cálculos dos percentuais
            const entradaPct = parseFloat(config.entrada_percentual) || 0;
            const obraPct = parseFloat(config.parcelas_obra_percentual) || 0;
            const remanescentePct = parseFloat(config.saldo_remanescente_percentual) || 0;

            // Valores totais por seção
            const totalEntrada = valorComDesconto * (entradaPct / 100);
            const totalObra = valorComDesconto * (obraPct / 100);
            const totalRemanescente = valorComDesconto * (remanescentePct / 100);
            
            // Parcelas
            const numParcelasEntrada = parseInt(config.num_parcelas_entrada) || 1;
            const valorParcelaEntrada = numParcelasEntrada > 0 ? totalEntrada / numParcelasEntrada : 0;

            const numParcelasObra = parseInt(config.num_parcelas_obra) || 1;
            const valorParcelaObra = numParcelasObra > 0 ? totalObra / numParcelasObra : 0;

            return {
                ...produto,
                valorFinal: valorComDesconto,
                totalEntrada,
                totalObra,
                totalRemanescente,
                numParcelasEntrada,
                valorParcelaEntrada,
                numParcelasObra,
                valorParcelaObra
            };
        });

    }, [produtos, config]);

    const numColunasEntrada = useMemo(() => Math.max(0, parseInt(config?.num_parcelas_entrada) || 0), [config]);

    const statusClasses = {
        'Disponível': 'row-disponivel',
        'Reservado': 'row-reservado',
        'Vendido': 'row-vendido'
    };
    
    // Injeta os estilos CSS diretamente no componente
    const tableStyles = `
        .sales-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
        .sales-table th, .sales-table td { border: 1px solid #dee2e6; padding: 8px 10px; text-align: center; vertical-align: middle; white-space: nowrap; }
        .sales-table thead { background-color: #f8f9fa; }
        .sales-table th { font-weight: 600; color: #343a40; }
        .sales-table .group-header { background-color: #e9ecef; }
        .sales-table .sub-header { background-color: #f8f9fa; font-size: 0.9em; }
        .number { text-align: right; }
        .row-disponivel { background-color: #fff; }
        .row-disponivel:nth-child(odd) { background-color: #f9f9f9; }
        .row-reservado { background-color: #fff3cd !important; color: #856404; }
        .row-vendido { background-color: #f8d7da !important; color: #721c24; }
    `;

    return (
        <div className="bg-white rounded-lg shadow p-6 mt-8">
            <style>{tableStyles}</style>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tabela de Venda</h2>
            <div className="overflow-x-auto">
                <table className="sales-table">
                    <thead>
                        <tr>
                            <th rowSpan="2">Unidade</th>
                            <th rowSpan="2">Tipo</th>
                            <th rowSpan="2">Área Un. (m²)</th>
                            <th rowSpan="2">Valor (R$)</th>
                            <th colSpan={numColunasEntrada + 1} className="group-header">Entrada ({config.entrada_percentual || 0}%)</th>
                            {parcelasAdicionais.map((p, i) => <th key={`adicional-header-${i}`} rowSpan="2">Intermediária<br/>{new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</th>)}
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
                            <tr key={item.id} className={statusClasses[item.status] || 'row-disponivel'}>
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
        </div>
    );
}
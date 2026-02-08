// components/SimuladorPrintView.js
"use client";

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ATENÇÃO: Removemos a prop 'empresa' pois não vamos mais buscar do banco
const SimuladorPrintView = React.forwardRef(({ simulacao, produto, empreendimento, contato, corretor, planoProposta, resumo }, ref) => {

    if (!simulacao || !resumo) {
        return null;
    }

    const logoUrl = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULO.PNG';

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    return (
        <div ref={ref} className="print-view p-8 bg-white text-gray-800 font-sans">
            <header className="flex justify-between items-center border-b-2 pb-4">
                <div className="text-left">
                    <img src={logoUrl} alt="Logo Studio 57" className="h-12" />
                    {/* ***** DADOS FIXOS INSERIDOS MANUALMENTE ***** */}
                    <p className="text-sm mt-2">CNPJ: 41.464.589/0001-66</p>
                    <p className="text-sm">Av. Rio Doce, 1825 - Ilha dos Araújos</p>
                    <p className="text-sm">Governador Valadares, MG - CEP: 35020-500</p>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-700">Proposta de Compra</h1>
                    <p className="text-sm mt-2">Data da Proposta: {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    <p className="text-sm">Proposta Nº: {simulacao.id}</p>
                </div>
            </header>

            <main className="mt-8">

                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Proponente e Corretor</h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div><strong>Proponente:</strong> {contato?.nome || 'N/A'}</div>
                        <div><strong>Corretor:</strong> {corretor?.nome || 'N/A'}</div>
                        <div><strong>Telefone:</strong> {contato?.telefone || 'N/A'}</div>
                        <div><strong>Telefone:</strong> {corretor?.telefone || 'N/A'}</div>
                    </div>
                </section>

                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Detalhes do Imóvel</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Empreendimento:</strong> {empreendimento?.nome || 'N/A'}</div>
                        <div><strong>Unidade:</strong> {produto?.unidade || 'N/A'}</div>
                        <div><strong>Tipo:</strong> {produto?.tipo || 'N/A'}</div>
                        <div><strong>Área:</strong> {produto?.area_m2 ? `${produto.area_m2} m²` : 'N/A'}</div>
                    </div>
                </section>

                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Resumo da Proposta Financeira</h2>
                    <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
                        <div className="flex justify-between items-center">
                            <span>Valor Base Total:</span>
                            <span className="font-semibold">{formatCurrency(resumo.valorBase)}</span>
                        </div>
                        <div className="flex justify-between items-center text-green-600">
                            <span>Desconto ({resumo.descontoPercentual.toFixed(2)}%):</span>
                            <span className="font-semibold">{formatCurrency(resumo.descontoValor)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-2 mt-2 font-bold text-base">
                            <span>Valor Final da Proposta:</span>
                            <span>{formatCurrency(resumo.valorFinal)}</span>
                        </div>
                        
                        <hr className="my-2"/>

                        <div className="flex justify-between items-center pt-2">
                            <span>Entrada ({resumo.entradaPercentual.toFixed(2)}%):</span>
                            <span className="font-semibold">{resumo.entradaNumParcelas}x de {formatCurrency(resumo.entradaValorParcela)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Parcelas Obra ({resumo.obraPercentual.toFixed(2)}%):</span>
                            <span className="font-semibold">{resumo.obraNumParcelas}x de {formatCurrency(resumo.obraValorParcela)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Intermediárias:</span>
                            <span className="font-semibold">{formatCurrency(resumo.totalIntermediarias)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Saldo Rem. ({resumo.saldoRemPercentual.toFixed(2)}%):</span>
                            <span className="font-semibold">{formatCurrency(resumo.saldoRemanescente)}</span>
                        </div>
                    </div>
                </section>
                
                <section>
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Plano de Pagamento Detalhado</h2>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2">Descrição</th>
                                <th className="p-2 text-center">Parcela Nº</th>
                                <th className="p-2 text-right">Vencimento</th>
                                <th className="p-2 text-right">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {planoProposta.map((parcela, index) => (
                                <tr key={index} className="border-b">
                                    <td className="p-2">{parcela.descricao}</td>
                                    <td className="p-2 text-center">{parcela.numero}</td>
                                    <td className="p-2 text-right">{parcela.vencimento}</td>
                                    <td className="p-2 text-right">{parcela.valor}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="mt-12 text-sm">
                    <p className="mb-4">
                        <strong>Observações:</strong> É direito do Studio 57 incorporação Ltda. corrigir ou alterar os valores sem aviso prévio. A correção é trimestral sobre o saldo devedor de acordo com o INCC.
                    </p>
                    <div className="mt-16 grid grid-cols-2 gap-16 text-center">
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

            <footer className="text-center text-xs text-gray-500 mt-12 pt-4 border-t">
                Studio 57 - Excelência em cada detalhe.
            </footer>
        </div>
    );
});

SimuladorPrintView.displayName = 'SimuladorPrintView';

export default SimuladorPrintView;
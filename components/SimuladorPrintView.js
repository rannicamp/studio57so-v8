// components/SimuladorPrintView.js
"use client";

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SimuladorPrintView = React.forwardRef(({ simulacao, produto, empreendimento, contato, corretor, planoProposta }, ref) => {

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
                    <img src="/logo-studio57.png" alt="Logo Studio 57" className="h-12" />
                    <p className="text-sm mt-2">CNPJ: 50.850.803/0001-38</p>
                    <p className="text-sm">Rua Israel Pinheiro, 2380, Centro</p>
                    <p className="text-sm">Governador Valadares, MG</p>
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-700">Proposta de Compra</h1>
                    <p className="text-sm mt-2">Data da Proposta: {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    <p className="text-sm">Proposta Nº: {simulacao.id}</p>
                </div>
            </header>

            <main className="mt-8">
                {/* Detalhes do Empreendimento e Produto */}
                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Detalhes do Imóvel</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Empreendimento:</strong> {empreendimento?.nome || 'N/A'}</div>
                        <div><strong>Unidade:</strong> {produto?.unidade || 'N/A'}</div>
                        <div><strong>Tipo:</strong> {produto?.tipo || 'N/A'}</div>
                        <div><strong>Área:</strong> {produto?.area_m2 ? `${produto.area_m2} m²` : 'N/A'}</div>
                    </div>
                </section>

                {/* Detalhes do Cliente */}
                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Dados do Proponente</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Nome:</strong> {contato?.nome || contato?.razao_social || 'N/A'}</div>
                        <div><strong>CPF/CNPJ:</strong> {contato?.cpf || contato?.cnpj || 'N/A'}</div>
                        <div><strong>Email:</strong> {contato?.emails?.[0]?.email || 'N/A'}</div>
                        <div><strong>Telefone:</strong> {contato?.telefones?.[0]?.telefone || 'N/A'}</div>
                    </div>
                </section>

                {/* Resumo Financeiro */}
                <section className="mb-6">
                    <h2 className="text-lg font-semibold border-b pb-2 mb-3">Resumo da Proposta Financeira</h2>
                    <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="font-semibold">Valor do Imóvel:</div>
                        <div className="text-right">{formatCurrency(simulacao.valor_venda)}</div>
                        
                        <div className="font-semibold">Desconto:</div>
                        <div className="text-right text-green-600">
                          {formatCurrency(simulacao.desconto_valor)} ({simulacao.desconto_percentual}%)
                        </div>

                        <div className="font-bold text-base border-t pt-2">Valor Final da Proposta:</div>
                        <div className="text-right font-bold text-base border-t pt-2">
                          {formatCurrency(simulacao.valor_venda - simulacao.desconto_valor)}
                        </div>
                    </div>
                </section>

                {/* Plano de Pagamento */}
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

                {/* Observações e Assinaturas */}
                <section className="mt-12 text-sm">
                    <p className="mb-4">
                        <strong>Observações:</strong> Esta proposta é válida por 7 dias a contar da data de emissão. Os valores serão corrigidos pelo CUB/SINDUSCON-MG até a entrega das chaves e, após, pelo IPCA + 1% ao mês.
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
                Studio 57 - Soluções Imobiliárias Inteligentes
            </footer>
        </div>
    );
});

SimuladorPrintView.displayName = 'SimuladorPrintView'; // Esta linha foi adicionada

export default SimuladorPrintView;
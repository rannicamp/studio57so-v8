// Caminho: components/contratos/PlanoPagamentoPrint.js

"use client";

import React from 'react';

const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Componente simplificado, apenas para layout
export default function PlanoPagamentoPrint({ contrato }) {
    if (!contrato) return null;

    const { contato: cliente, produto, empreendimento, contrato_parcelas: parcelas } = contrato;
    const empresa = empreendimento?.empresa;

    const totalGeral = parcelas.reduce((acc, p) => acc + parseFloat(p.valor_parcela || 0), 0);

    return (
        <div className="p-4 font-sans text-gray-800">
            {/* Cabeçalho */}
            <header className="flex justify-between items-center border-b-2 pb-4">
                <div>
                    <h1 className="text-2xl font-bold">{empresa?.nome_fantasia || 'Nome da Empresa'}</h1>
                    <p className="text-sm">{empresa?.razao_social}</p>
                    <p className="text-sm">CNPJ: {empresa?.cnpj}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-semibold">Extrato do Contrato</h2>
                    <p className="text-sm">Contrato Nº: {contrato.id}</p>
                    <p className="text-sm">Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </header>

            {/* Informações das Partes */}
            <section className="my-6 grid grid-cols-2 gap-6">
                <div className="border p-4 rounded-md">
                    <h3 className="font-bold mb-2 border-b pb-1">CLIENTE (COMPRADOR)</h3>
                    <p><strong>Nome:</strong> {cliente?.nome || cliente?.razao_social}</p>
                    <p><strong>CPF/CNPJ:</strong> {cliente?.cpf || cliente?.cnpj}</p>
                </div>
                <div className="border p-4 rounded-md">
                    <h3 className="font-bold mb-2 border-b pb-1">UNIDADE</h3>
                    <p><strong>Empreendimento:</strong> {empreendimento?.nome}</p>
                    <p><strong>Unidade:</strong> {produto?.unidade} {produto?.bloco && `- Bloco ${produto.bloco}`}</p>
                </div>
            </section>

            {/* Tabela do Plano de Pagamento */}
            <section>
                <h3 className="text-lg font-bold mb-2">PLANO DE PAGAMENTO</h3>
                <table className="w-full text-sm border-collapse border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 text-left">Descrição</th>
                            <th className="border p-2 text-left">Vencimento</th>
                            <th className="border p-2 text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parcelas && parcelas.map((p) => (
                            <tr key={p.id}>
                                <td className="border p-2">{p.descricao}</td>
                                <td className="border p-2">{formatDate(p.data_vencimento)}</td>
                                <td className="border p-2 text-right">{formatCurrency(p.valor_parcela)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-200 font-bold">
                            <td colSpan="2" className="border p-2 text-right">VALOR TOTAL:</td>
                            <td className="border p-2 text-right">{formatCurrency(totalGeral)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>

            {/* Rodapé */}
            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>Este é um extrato do plano de pagamento e não possui validade fiscal.</p>
                <p>{empresa?.nome_fantasia || 'Nome da Empresa'} © {new Date().getFullYear()}</p>
            </footer>
        </div>
    );
};
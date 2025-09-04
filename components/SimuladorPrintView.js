// components/SimuladorPrintView.js
'use client';

import React from 'react';

// Funções de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForDisplay = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
const formatPhone = (phone, countryCode) => {
    if (!phone) return 'Não informado';
    return `${countryCode} ${phone}`;
}


const SimuladorPrintView = React.forwardRef(({ simulacaoData }, ref) => {
    if (!simulacaoData || !simulacaoData.resumo) return null;

    const { empreendimento, produtos, cronograma, valorFinal, resumo, cliente, corretor } = simulacaoData;
    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

    return (
        <div ref={ref} className="p-4 font-sans text-gray-800">
            <header className="flex justify-between items-center border-b-2 border-gray-300 pb-4 mb-6">
                <img src={logoUrl} alt="Logo Studio 57" className="h-14 w-auto" />
                <div className="text-right">
                    <h2 className="text-xl font-semibold">Simulação de Pagamento</h2>
                    <p className="text-sm">Data da Simulação: {new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </header>
            
            <section className="mb-6 grid grid-cols-2 gap-4">
                <div className="border p-3 rounded-md bg-gray-50 text-sm">
                    <h3 className="font-bold mb-2 border-b pb-1 text-gray-700">CLIENTE</h3>
                    <p><strong>Nome:</strong> {cliente?.nome || 'Não informado'}</p>
                    <p><strong>Telefone:</strong> {formatPhone(cliente?.telefone, cliente?.country_code)}</p>
                </div>
                <div className="border p-3 rounded-md bg-gray-50 text-sm">
                    <h3 className="font-bold mb-2 border-b pb-1 text-gray-700">CORRETOR</h3>
                    <p><strong>Nome:</strong> {corretor?.nome || 'Não informado'}</p>
                    <p><strong>Telefone:</strong> {formatPhone(corretor?.telefone, corretor?.country_code)}</p>
                </div>
            </section>


            <section className="mb-6 border p-4 rounded-md bg-gray-50">
                <h3 className="font-bold mb-2 border-b pb-1 text-gray-700">IMÓVEL DE INTERESSE</h3>
                <p><strong>Empreendimento:</strong> {empreendimento?.nome}</p>
                <div>
                    <strong>Unidades:</strong>
                    {produtos && produtos.length > 0 ? (
                        <ul className="list-disc pl-5">
                            {produtos.map(p => (
                                <li key={p.id}>{p.unidade} ({p.tipo}) - {formatCurrency(p.valor_venda_calculado)}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>Nenhuma unidade selecionada.</p>
                    )}
                </div>
            </section>

            <section className="mb-6">
                 <h3 className="text-lg font-bold mb-2">RESUMO DA PROPOSTA</h3>
                <div className="p-4 border rounded-md space-y-2 text-base">
                    <div className="flex justify-between items-center"><span className="text-gray-600">Valor Base Total:</span><span className="font-semibold text-blue-700">{formatCurrency(resumo.valorBase)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-600">Desconto ({resumo.descontoPercentual.toFixed(2)}%):</span><span className="font-semibold text-red-600">{formatCurrency(resumo.descontoValor)}</span></div>
                    <div className="flex justify-between items-center border-t pt-2 mt-2"><span className="font-bold text-gray-800">Valor Final (c/ Desc.):</span><span className="font-bold text-green-700 text-lg">{formatCurrency(resumo.valorFinal)}</span></div>
                    <hr className="my-3"/>
                    <div className="flex justify-between items-center"><span className="text-gray-600">Entrada ({resumo.entradaPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumo.entradaNumParcelas}x de {formatCurrency(resumo.entradaValorParcela)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-600">Parcelas Obra ({resumo.obraPercentual.toFixed(2)}%):</span><span className="font-semibold">{resumo.obraNumParcelas}x de {formatCurrency(resumo.obraValorParcela)}</span></div>
                    {resumo.totalIntermediarias > 0 && (
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Intermediárias:</span>
                            <span className="font-semibold">{formatCurrency(resumo.totalIntermediarias)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center"><span className="text-gray-600">Saldo Rem. ({resumo.saldoRemPercentual.toFixed(2)}%):</span><span className="font-semibold">{formatCurrency(resumo.saldoRemanescente)}</span></div>
                    <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-2 mt-2"><span className="font-semibold">Mês/Ano Última Parc. Obra:</span><span>{resumo.mesAnoUltimaParcelaObra}</span></div>
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold mb-2">CRONOGRAMA DETALHADO</h3>
                <table className="w-full text-xs border-collapse border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 text-left">Descrição</th>
                            <th className="border p-2 text-left">Vencimento</th>
                            <th className="border p-2 text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cronograma.map((p) => (
                            <tr key={p.id}>
                                <td className="border p-2">{p.descricao}</td>
                                <td className="border p-2">{formatDateForDisplay(p.data_vencimento)}</td>
                                <td className="border p-2 text-right font-medium">{formatCurrency(p.valor_parcela)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr>
                            <td colSpan="2" className="border p-2 text-right">VALOR TOTAL A PAGAR:</td>
                            <td className="border p-2 text-right">{formatCurrency(valorFinal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>

            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>Esta é uma simulação e não representa um documento de contrato. Os valores e condições estão sujeitos a alterações e aprovação.</p>
                <p>Studio 57 © {new Date().getFullYear()}</p>
            </footer>
        </div>
    );
});

export default SimuladorPrintView;
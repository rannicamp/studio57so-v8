"use client";

import React, { useMemo } from 'react';

// Mantive sua regra de formatação de datas simples (sem new Date)
const formatDateForDisplay = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function PlanoPagamentoPrint({ contrato, signatory, geradoPor }) {
    // =================================================================================
    // CORREÇÃO:
    // 1. Garantimos que 'parcelas' e 'permutas' sejam sempre arrays, mesmo se 'contrato' for nulo.
    // Usamos o operador de encadeamento opcional (?.) e o operador de coalescência nula (??).
    // =================================================================================
    const parcelas = contrato?.contrato_parcelas ?? [];
    const permutas = contrato?.contrato_permutas ?? [];
    
    // =================================================================================
    // 2. O hook 'useMemo' agora é chamado INCONDICIONALMENTE no topo do componente,
    //    usando as variáveis seguras que criamos acima. Isso satisfaz as regras do React.
    // =================================================================================
    const planoPagamentoOrdenado = useMemo(() => {
        const todasAsEntradas = [];

        permutas.forEach(permuta => {
            todasAsEntradas.push({
                id: `permuta-${permuta.id}`,
                data: permuta.data_registro,
                descricao: `${permuta.descricao} (Permuta)`,
                valor: -Math.abs(permuta.valor_permutado || 0), // Negativo para abatimento
                isPermuta: true,
            });
        });

        parcelas.forEach(p => {
            todasAsEntradas.push({
                id: p.id,
                data: p.data_vencimento,
                descricao: p.descricao,
                valor: parseFloat(p.valor_parcela || 0),
                isPermuta: false,
            });
        });

        // Ordena a lista combinada pela data
        return todasAsEntradas.sort((a, b) => new Date(a.data) - new Date(b.data));
    }, [parcelas, permutas]);

    // =================================================================================
    // 3. AGORA, depois que todos os hooks foram chamados, podemos fazer a verificação
    //    e retornar mais cedo se o contrato não existir.
    // =================================================================================
    if (!contrato) {
        return null;
    }

    // A partir daqui, o resto do seu código original pode assumir que 'contrato' existe.
    const { 
        contato: cliente, 
        produtos = [], 
        empreendimento, 
        valor_final_venda: valorTotalContrato 
    } = contrato;
    
    const empresa = empreendimento?.empresa_proprietaria_id;
    
    const unidadesTexto = produtos.map(p => `${p.unidade} ${p.bloco ? `- Bloco ${p.bloco}` : ''}`.trim()).join(', ') || 'N/A';

    const totalParcelas = parcelas.reduce((acc, p) => acc + parseFloat(p.valor_parcela || 0), 0);
    const totalPermutas = permutas.reduce((acc, p) => acc + parseFloat(p.valor_permutado || 0), 0);
    const saldoAPagar = valorTotalContrato - totalPermutas;
    const saldoRemanescente = saldoAPagar - totalParcelas;

    return (
        <div className="p-4 print:p-0 font-sans text-gray-800">
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
                    <p><strong>Unidade(s):</strong> {unidadesTexto}</p>
                </div>
            </section>

            {/* Tabela do Plano de Pagamento */}
            <section>
                <h3 className="text-lg font-bold mb-2">PLANO DE PAGAMENTO</h3>
                <table className="w-full text-sm border-collapse border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2 text-left">Descrição</th>
                            <th className="border p-2 text-left">Data</th>
                            <th className="border p-2 text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {planoPagamentoOrdenado.map((item) => (
                            <tr key={item.id} className={item.isPermuta ? "bg-blue-50" : ""}>
                                <td className={`border p-2 ${item.isPermuta ? "font-medium" : ""}`}>{item.descricao}</td>
                                <td className="border p-2">{formatDateForDisplay(item.data)}</td>
                                <td className={`border p-2 text-right ${item.isPermuta ? "font-semibold text-blue-700" : ""}`}>
                                    {formatCurrency(item.valor)}
                                </td>
                            </tr>
                        ))}
                        
                        {/* Rodapé da tabela com os totais */}
                        <tr className="bg-gray-200 font-bold">
                            <td colSpan="2" className="border p-2 text-right">VALOR TOTAL DO CONTRATO:</td>
                            <td className="border p-2 text-right">{formatCurrency(valorTotalContrato)}</td>
                        </tr>
                        <tr className="bg-gray-200 font-bold text-blue-800">
                            <td colSpan="2" className="border p-2 text-right">(-) TOTAL EM PERMUTAS:</td>
                            <td className="border p-2 text-right">-{formatCurrency(totalPermutas)}</td>
                        </tr>
                         <tr className="bg-gray-200 font-bold">
                            <td colSpan="2" className="border p-2 text-right">(=) SALDO A PAGAR:</td>
                            <td className="border p-2 text-right">{formatCurrency(saldoAPagar)}</td>
                        </tr>
                        <tr className="bg-gray-200 font-bold text-green-800">
                            <td colSpan="2" className="border p-2 text-right">TOTAL DAS PARCELAS:</td>
                            <td className="border p-2 text-right">{formatCurrency(totalParcelas)}</td>
                        </tr>
                         <tr className={`font-bold ${Math.abs(saldoRemanescente) > 0.01 ? 'bg-red-200' : 'bg-gray-200'}`}>
                            <td colSpan="2" className="border p-2 text-right">(=) SALDO REMANESCENTE:</td>
                            <td className="border p-2 text-right">{formatCurrency(saldoRemanescente)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Seção de Assinaturas */}
            <section className="signature-section text-center mt-8">
                <div className="flex justify-around items-start pt-8">
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{cliente?.nome || cliente?.razao_social}</p>
                        <p className="text-xs">CPF/CNPJ: {cliente?.cpf || cliente?.cnpj || 'N/A'}</p>
                    </div>
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{signatory?.name}</p>
                        <p className="text-xs">CPF: {signatory?.cpf || 'N/A'}</p>
                    </div>
                </div>
            </section>

            {/* Rodapé */}
            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>Este é um extrato do plano de pagamento e não possui validade fiscal.</p>
                <p>{empresa?.nome_fantasia || 'Nome da Empresa'} © {new Date().getFullYear()}</p>
                <p className="mt-2">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </footer>
        </div>
    );
};
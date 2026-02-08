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
    const parcelas = contrato?.contrato_parcelas ?? [];
    const permutas = contrato?.contrato_permutas ?? [];
    
    // Lógica para ordenar a tabela de parcelas (INALTERADA)
    const planoPagamentoOrdenado = useMemo(() => {
        const todasAsEntradas = [];

        // 1. Adiciona as Permutas primeiro
        permutas.forEach(permuta => {
            todasAsEntradas.push({
                id: `permuta-${permuta.id}`,
                data: permuta.data_registro,
                descricao: `${permuta.descricao} (Permuta)`,
                valor: -Math.abs(permuta.valor_permutado || 0), // Negativo para abatimento
                isPermuta: true,
            });
        });

        // 2. Separa as parcelas "normais" da de "saldo"
        const parcelasNormais = parcelas.filter(p => 
            p.tipo !== 'Saldo Remanescente' && 
            !p.descricao?.toLowerCase().includes('saldo remanescente')
        );
        const parcelaSaldoOriginal = parcelas.find(p => 
            p.tipo === 'Saldo Remanescente' || 
            p.descricao?.toLowerCase().includes('saldo remanescente')
        );

        // 3. Adiciona as parcelas "normais" à lista
        parcelasNormais.forEach(p => {
            todasAsEntradas.push({
                id: p.id,
                data: p.data_vencimento,
                descricao: p.descricao,
                valor: parseFloat(p.valor_parcela || 0),
                isPermuta: false,
            });
        });

        // 4. Ordena a lista (sem o saldo) pela data
        const listaOrdenada = todasAsEntradas.sort((a, b) => new Date(a.data) - new Date(b.data));

        // 5. Calcula o valor do saldo "inteligente"
        const totalParcelasNormais = parcelasNormais.reduce((acc, p) => acc + parseFloat(p.valor_parcela || 0), 0);
        const totalPermutas = permutas.reduce((acc, p) => acc + parseFloat(p.valor_permutado || 0), 0);
        const valorSaldoCalculado = (contrato?.valor_final_venda || 0) - totalParcelasNormais - totalPermutas;

        // 6. Adiciona o saldo calculado como o ÚLTIMO item da lista
        listaOrdenada.push({
            id: parcelaSaldoOriginal?.id || 'saldo-calculado',
            data: parcelaSaldoOriginal?.data_vencimento || 'N/A',
            descricao: parcelaSaldoOriginal?.descricao || 'Saldo Remanescente (Chaves)',
            valor: valorSaldoCalculado,
            isPermuta: false,
            isSaldo: true, // Flag para estilização
        });

        return listaOrdenada;
    
    }, [parcelas, permutas, contrato?.valor_final_venda]); // Dependência atualizada

    if (!contrato) {
        return null;
    }

    const { 
        contato: cliente, 
        produtos = [], 
        empreendimento, 
        valor_final_venda: valorTotalContrato 
    } = contrato;
    
    const empresa = empreendimento?.empresa_proprietaria_id;
    
    const unidadesTexto = produtos.map(p => `${p.unidade} ${p.bloco ? `- Bloco ${p.bloco}` : ''}`.trim()).join(', ') || 'N/A';

    // =================================================================================
    // LÓGICA "INTELIGENTE" PARA O RODAPÉ (igual à da tela) (INALTERADA)
    // =================================================================================
    const parcelasNormais = parcelas.filter(p => 
        p.tipo !== 'Saldo Remanescente' && 
        !p.descricao?.toLowerCase().includes('saldo remanescente')
    );
    const parcelaSaldoOriginal = parcelas.find(p => 
        p.tipo === 'Saldo Remanescente' || 
        p.descricao?.toLowerCase().includes('saldo remanescente')
    );

    const totalParcelasNormais = parcelasNormais.reduce((acc, p) => acc + parseFloat(p.valor_parcela || 0), 0);
    const totalPermutas = permutas.reduce((acc, p) => acc + parseFloat(p.valor_permutado || 0), 0);
    const valorSaldoCalculado = (valorTotalContrato || 0) - totalParcelasNormais - totalPermutas;

    const displaySaldoRemanescente = {
        descricao: parcelaSaldoOriginal?.descricao || 'Saldo Remanescente (Chaves)',
        valor: valorSaldoCalculado
    };

    // Este "saldoAPagar" é = (Valor Total - Permutas)
    const saldoAPagar = (valorTotalContrato || 0) - totalPermutas;
    // =================================================================================
    // FIM DA LÓGICA DE TOTAIS
    // =================================================================================

    return (
        <div className="p-4 print:p-0 font-sans text-gray-800">
            
            {/* Cabeçalho (ALTERADO PARA TABLE) */}
            <header className="border-b-2 pb-4">
                <table className="w-full">
                    <tbody>
                        <tr>
                            <td className="w-1/2 align-top">
                                <h1 className="text-2xl font-bold">{empresa?.nome_fantasia || 'Nome da Empresa'}</h1>
                                <p className="text-sm">{empresa?.razao_social}</p>
                                <p className="text-sm">CNPJ: {empresa?.cnpj}</p>
                            </td>
                            <td className="w-1/2 align-top text-right">
                                <h2 className="text-xl font-semibold">Extrato do Contrato</h2>
                                <p className="text-sm">Contrato Nº: {contrato.id}</p>
                                <p className="text-sm">Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </header>

            {/* Informações das Partes (ALTERADO PARA TABLE) */}
            <section className="my-6">
                <table className="w-full">
                    <tbody>
                        <tr>
                            <td className="w-1/2 pr-3 align-top">
                                <div className="border p-4 rounded-md h-full"> {/* Adicionado h-full para igualar altura se necessário */}
                                    <h3 className="font-bold mb-2 border-b pb-1">CLIENTE (COMPRADOR)</h3>
                                    <p><strong>Nome:</strong> {cliente?.nome || cliente?.razao_social}</p>
                                    <p><strong>CPF/CNPJ:</strong> {cliente?.cpf || cliente?.cnpj}</p>
                                </div>
                            </td>
                            <td className="w-1/2 pl-3 align-top">
                                <div className="border p-4 rounded-md h-full"> {/* Adicionado h-full para igualar altura se necessário */}
                                    <h3 className="font-bold mb-2 border-b pb-1">UNIDADE</h3>
                                    <p><strong>Empreendimento:</strong> {empreendimento?.nome}</p>
                                    <p><strong>Unidade(s):</strong> {unidadesTexto}</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Tabela do Plano de Pagamento (INALTERADA) */}
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
                            <tr key={item.id} className={item.isPermuta ? "bg-blue-50" : (item.isSaldo ? "bg-blue-50 font-bold text-blue-700" : "")}>
                                <td className={`border p-2 ${item.isPermuta || item.isSaldo ? "font-medium" : ""}`}>{item.descricao}</td>
                                <td className="border p-2">{formatDateForDisplay(item.data)}</td>
                                <td className={`border p-2 text-right ${item.isPermuta ? "font-semibold text-blue-700" : (item.isSaldo ? "font-semibold" : "")}`}>
                                    {formatCurrency(item.valor)}
                                </td>
                            </tr>
                        ))}
                        
                        {/* Rodapé da tabela com a lógica "inteligente" (INALTERADO) */}
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
                        <tr className="bg-gray-200 font-bold text-gray-800">
                            <td colSpan="2" className="border p-2 text-right">Total Parcelas (Entrada + Obra + Adicionais):</td>
                            <td className="border p-2 text-right">{formatCurrency(totalParcelasNormais)}</td>
                        </tr>
                        <tr className="bg-gray-200 font-bold text-blue-800">
                            <td colSpan="2" className="border p-2 text-right">{displaySaldoRemanescente.descricao}:</td>
                            <td className="border p-2 text-right">{formatCurrency(displaySaldoRemanescente.valor)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Seção de Assinaturas (ALTERADO PARA TABLE E CORRIGIDO TYPO) */}
            <section className="signature-section text-center mt-8">
                {/* O 'pt-8' foi movido para a tabela para garantir o espaçamento */}
                <table className="w-full" style={{ borderTop: 'none', marginTop: '32px' }}>
                    <tbody>
                        <tr>
                            <td className="w-1/2 px-4" style={{ verticalAlign: 'top' }}>
                                <div className="border-t border-black w-full mx-auto" style={{ paddingTop: '8px' }}></div>
                                <p className="mt-2 text-sm font-semibold">{cliente?.nome || cliente?.razao_social}</p>
                                <p className="text-xs">CPF/CNPJ: {cliente?.cpf || cliente?.cnpj || 'N/A'}</p>
                            </td>
                            <td className="w-1/2 px-4" style={{ verticalAlign: 'top' }}>
                                <div className="border-t border-black w-full mx-auto" style={{ paddingTop: '8px' }}></div>
                                <p className="mt-2 text-sm font-semibold">{signatory?.name}</p>
                                {/* CORREÇÃO: Removido o 's s' que estava solto aqui */}
                                <p className="text-xs">CPF: {signatory?.cpf || 'N/A'}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Rodapé (INALTERADO) */}
            <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>Este é um extrato do plano de pagamento e não possui validade fiscal.</p>
                <p>{empresa?.nome_fantasia || 'Nome da Empresa'} © {new Date().getFullYear()}</p>
                <p className="mt-2">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </footer>
        </div>
    );
};
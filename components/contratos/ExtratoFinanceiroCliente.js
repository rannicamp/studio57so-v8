// components/contratos/ExtratoFinanceiroCliente.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner,
    faMoneyBillWave,
    faCheckCircle,
    faClock,
    faExclamationCircle,
    faArrowUp,
    faArrowDown,
    faPrint,
    faBuilding
} from '@fortawesome/free-solid-svg-icons';

// Funções de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

// Helper para formatar CPF/CNPJ
const formatDoc = (doc) => {
    if (!doc) return '-';
    return doc.replace(/\D/g, '').length > 11
        ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
        : doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const fetchExtratoFinanceiro = async (supabase, contratoId, organizacaoId) => {
    if (!contratoId || !organizacaoId) return [];

    const { data, error } = await supabase
        .from('lancamentos')
        .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
        .eq('contrato_id', contratoId)
        .eq('organizacao_id', organizacaoId)
        // Ordem cronológica: Antigos (Pagos) em cima, Futuros (Pendentes) embaixo
        .order('data_vencimento', { ascending: true });

    if (error) {
        console.error("Erro ao buscar extrato financeiro:", error);
        throw new Error("Falha ao buscar o histórico financeiro.");
    }
    return data || [];
};

export default function ExtratoFinanceiroCliente({ contratoId, contrato }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: lancamentos = [], isLoading, isError, error } = useQuery({
        queryKey: ['extratoFinanceiroCliente', contratoId, organizacaoId],
        queryFn: () => fetchExtratoFinanceiro(supabase, contratoId, organizacaoId),
        enabled: !!contratoId && !!organizacaoId,
    });

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" /> Carregando...</div>;
    if (isError) return <div className="text-red-500">Erro: {error.message}</div>;

    // Totais (Considerando Pago e Conciliado)
    const totalPago = lancamentos
        .filter(l => (l.status === 'Pago' || l.status === 'Conciliado') && l.tipo === 'Receita')
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);

    const totalPendente = lancamentos
        .filter(l => l.status === 'Pendente' && l.tipo === 'Receita')
        .reduce((acc, curr) => acc + (curr.valor || 0), 0);

    // --- PREPARAÇÃO DOS DADOS PARA O CABEÇALHO ---
    const cliente = contrato?.contato || {};
    const conjuge = contrato?.conjuge;
    const empreendimento = contrato?.empreendimento || {};

    // --- LÓGICA DE UNIDADES MÚLTIPLAS ---
    // Agora pegamos TODAS as unidades da lista, não apenas a primeira [0]
    const listaProdutos = contrato?.produtos || [];

    // Mapeia cada produto para uma string formatada (ex: "502 (Tipo 2)")
    const unidadesFormatadas = listaProdutos.map(prod => {
        if (prod.unidade) {
            return `${prod.unidade} ${prod.tipo ? `(${prod.tipo})` : ''}`;
        } else if (prod.nome) {
            return `${prod.nome} ${prod.tipo ? `(${prod.tipo})` : ''}`;
        } else {
            return prod.tipo || 'Unidade sem nome';
        }
    });

    // Junta tudo com vírgula (ex: "502 (Ap), 12 (Garagem)")
    const displayUnidades = unidadesFormatadas.length > 0 ? unidadesFormatadas.join(', ') : 'Geral';

    const enderecoCliente = [
        cliente.address_street,
        cliente.address_number,
        cliente.neighborhood,
        cliente.city,
        cliente.state
    ].filter(Boolean).join(', ');

    return (
        <>
            {/* --- VISÃO DE TELA (WIDGET COLORIDO) --- */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex-shrink-0 space-y-8 animate-fade-in print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                    <h3 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Extrato Financeiro
                    </h3>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handlePrint}
                            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2 shadow-sm flex-grow md:flex-grow-0"
                        >
                            <FontAwesomeIcon icon={faPrint} /> Imprimir Extrato
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                        <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-2 block">Total Recebido</span>
                        <div className="text-3xl font-extrabold text-green-700 tracking-tight">{formatCurrency(totalPago)}</div>
                        <span className="text-xs text-green-600/80 font-bold mt-1 block">Soma de Pago + Conciliado</span>
                    </div>
                    <div className="bg-yellow-50/50 p-6 rounded-2xl border border-yellow-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                        <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest mb-2 block">Pendente</span>
                        <div className="text-3xl font-extrabold text-yellow-700 tracking-tight">{formatCurrency(totalPendente)}</div>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-inner scrollbar-hide">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50/80">
                            <tr>
                                <th className="px-4 py-3 text-left font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Vencimento</th>
                                <th className="px-4 py-3 text-left font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Descrição</th>
                                <th className="px-4 py-3 text-right font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Valor</th>
                                <th className="px-4 py-3 text-center font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-50">
                            {lancamentos.map(l => {
                                // LÓGICA DE EXIBIÇÃO: Conciliado vira Pago visualmente
                                const isPagoReal = l.status === 'Pago' || l.status === 'Conciliado';
                                const statusDisplay = isPagoReal ? 'Pago' : l.status;
                                const statusColor = isPagoReal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
                                const statusIcon = isPagoReal ? faCheckCircle : faClock;
                                const valorColor = l.tipo === 'Receita' ? 'text-green-600' : 'text-red-500';

                                return (
                                    <tr key={l.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-600">{formatDate(l.data_vencimento)}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-800">
                                            {l.descricao}
                                            <div className="text-xs font-medium text-gray-400 mt-0.5 tracking-wide">{l.categoria?.nome}</div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold tracking-tight ${valorColor}`}>
                                            {formatCurrency(l.valor)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${statusColor}`}>
                                                <FontAwesomeIcon icon={statusIcon} className="text-base" />
                                                {statusDisplay}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- VISÃO DE IMPRESSÃO --- */}
            <div id="printable-extrato" className="hidden print:block font-serif text-black s57-print-area print:p-8">

                {/* Cabeçalho */}
                <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wide">Extrato Financeiro</h1>
                        <p className="text-sm text-gray-600">Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="font-bold text-lg">{empreendimento.nome || "Studio 57"}</h2>
                        <p className="text-sm">{organizacaoId === 2 ? 'Administração Geral' : 'Gestão Financeira'}</p>
                    </div>
                </div>

                {/* Dados Cliente/Compra */}
                <div className="grid grid-cols-2 gap-8 mb-6 text-sm border p-4 rounded-md">
                    <div>
                        <h3 className="font-bold border-b mb-2 uppercase text-gray-700">Dados do Cliente</h3>
                        <p><strong>Nome:</strong> {cliente.nome || cliente.razao_social}</p>
                        <p><strong>CPF/CNPJ:</strong> {formatDoc(cliente.cpf || cliente.cnpj)}</p>
                        <p><strong>Endereço:</strong> {enderecoCliente || 'Não informado'}</p>
                        {conjuge && <p><strong>Cônjuge:</strong> {conjuge.nome}</p>}
                        <p><strong>Telefone:</strong> {cliente.telefones?.[0]?.telefone || '-'}</p>
                    </div>
                    <div>
                        <h3 className="font-bold border-b mb-2 uppercase text-gray-700">Dados da Compra</h3>
                        <p><strong>Empreendimento:</strong> {empreendimento.nome}</p>
                        {/* AQUI ESTÁ A CORREÇÃO: Lista todas as unidades */}
                        <p><strong>Unidades/Lotes:</strong> {displayUnidades}</p>
                        <p><strong>Contrato Nº:</strong> {contrato.numero_contrato || contrato.id}</p>
                        <p><strong>Data Venda:</strong> {formatDate(contrato.data_venda)}</p>
                    </div>
                </div>

                {/* Resumo Impressão */}
                <div className="mb-6 bg-gray-50 border p-2 flex justify-end gap-6 text-sm">
                    <div>Total Contrato: <strong>{formatCurrency(contrato.valor_final_venda)}</strong></div>
                    <div>Total Pago: <strong>{formatCurrency(totalPago)}</strong></div>
                    <div>Saldo Devedor: <strong>{formatCurrency(totalPendente)}</strong></div>
                </div>

                {/* Tabela Impressão */}
                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-gray-300 px-2 py-1 text-left w-24">Vencimento</th>
                            <th className="border border-gray-300 px-2 py-1 text-left w-24">Pagamento</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Descrição / Parcela</th>
                            <th className="border border-gray-300 px-2 py-1 text-right w-28">Valor Orig.</th>
                            <th className="border border-gray-300 px-2 py-1 text-center w-24">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lancamentos.map((l, index) => {
                            // MESMA LÓGICA VISUAL APLICADA NA IMPRESSÃO
                            const isPagoReal = l.status === 'Pago' || l.status === 'Conciliado';
                            const statusDisplay = isPagoReal ? 'Pago' : l.status;

                            return (
                                <tr key={l.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="border border-gray-300 px-2 py-1">{formatDate(l.data_vencimento)}</td>
                                    <td className="border border-gray-300 px-2 py-1">{l.data_pagamento ? formatDate(l.data_pagamento) : '-'}</td>
                                    <td className="border border-gray-300 px-2 py-1">
                                        {l.descricao}
                                        {l.parcela_info && <span className="text-xs ml-2">({l.parcela_info})</span>}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">{formatCurrency(l.valor)}</td>
                                    <td className="border border-gray-300 px-2 py-1 text-center font-bold text-xs uppercase">
                                        {statusDisplay}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Rodapé Assinatura */}
                <div className="mt-16 pt-8 border-t border-black flex justify-between text-xs break-inside-avoid">
                    <div className="text-center w-1/3">
                        <div className="border-t border-black w-full mb-2"></div>
                        <p>{empreendimento.nome}</p>
                    </div>
                    <div className="text-center w-1/3">
                        <div className="border-t border-black w-full mb-2"></div>
                        <p>{cliente.nome || cliente.razao_social}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
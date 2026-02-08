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

const fetchExtratoFinanceiro = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return [];

    const { data, error } = await supabase
        .from('lancamentos')
        .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
        .eq('favorecido_contato_id', contatoId)
        .eq('organizacao_id', organizacaoId)
        // Ordem cronológica: Antigos (Pagos) em cima, Futuros (Pendentes) embaixo
        .order('data_vencimento', { ascending: true });

    if (error) {
        console.error("Erro ao buscar extrato financeiro:", error);
        throw new Error("Falha ao buscar o histórico financeiro.");
    }
    return data || [];
};

export default function ExtratoFinanceiroCliente({ contatoId, contrato }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: lancamentos = [], isLoading, isError, error } = useQuery({
        queryKey: ['extratoFinanceiroCliente', contatoId, organizacaoId],
        queryFn: () => fetchExtratoFinanceiro(supabase, contatoId, organizacaoId),
        enabled: !!contatoId && !!organizacaoId,
    });

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500"/> Carregando...</div>;
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
            {/* ESTILOS ESPECÍFICOS DE IMPRESSÃO */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-extrato, #printable-extrato * { visibility: visible; }
                    #printable-extrato {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                        color: black;
                        margin: 0;
                        padding: 20px;
                    }
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; }
                }
            `}</style>

            {/* --- VISÃO DE TELA (WIDGET COLORIDO) --- */}
            <div className="bg-white p-6 rounded-lg shadow-md border space-y-6 animate-fade-in print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="text-green-600"/> 
                        Extrato Financeiro
                    </h3>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePrint}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPrint} /> Imprimir Extrato
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <span className="text-gray-600 text-sm uppercase font-semibold">Total Recebido</span>
                        <div className="text-2xl font-bold text-green-700">{formatCurrency(totalPago)}</div>
                        <span className="text-xs text-green-600">Soma de Pago + Conciliado</span>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <span className="text-gray-600 text-sm uppercase font-semibold">Pendente</span>
                        <div className="text-2xl font-bold text-yellow-700">{formatCurrency(totalPendente)}</div>
                    </div>
                </div>
                
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Vencimento</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Descrição</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">Valor</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {lancamentos.map(l => {
                                // LÓGICA DE EXIBIÇÃO: Conciliado vira Pago visualmente
                                const isPagoReal = l.status === 'Pago' || l.status === 'Conciliado';
                                const statusDisplay = isPagoReal ? 'Pago' : l.status;
                                const statusColor = isPagoReal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
                                const statusIcon = isPagoReal ? faCheckCircle : faClock;
                                const valorColor = l.tipo === 'Receita' ? 'text-green-600' : 'text-red-600';

                                return (
                                    <tr key={l.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-600">{formatDate(l.data_vencimento)}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {l.descricao}
                                            <div className="text-xs text-gray-400">{l.categoria?.nome}</div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${valorColor}`}>
                                            {formatCurrency(l.valor)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                                <FontAwesomeIcon icon={statusIcon} size="xs" />
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
            <div id="printable-extrato" className="hidden print:block font-serif text-black">
                
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
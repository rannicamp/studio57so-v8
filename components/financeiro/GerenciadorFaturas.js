// components/financeiro/GerenciadorFaturas.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard, faCalendarAlt, faCheckCircle, faLock,
    faLockOpen, faExclamationTriangle, faMoneyBillWave, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PagamentoFaturaModal from './PagamentoFaturaModal';

export default function GerenciadorFaturas({ contasCartao, onNewDespesaCartao }) {
    const supabase = createClient();
    const [contaSelecionadaId, setContaSelecionadaId] = useState(contasCartao?.[0]?.id || '');
    const [faturaParaPagar, setFaturaParaPagar] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    // NOVO STATE: Fatura Selecionada pelo Usuário para ver o extrato
    const [faturaAbertaDataVencimento, setFaturaAbertaDataVencimento] = useState('');

    // 1. Busca lançamentos ESPECÍFICOS do cartão selecionado (sem filtros globais para ver a realidade total)
    const { data: lancamentos = [], isLoading } = useQuery({
        queryKey: ['lancamentosCartao', contaSelecionadaId],
        queryFn: async () => {
            if (!contaSelecionadaId) return [];
            // Buscamos tudo desta conta para montar o histórico de faturas
            // A data_vencimento no banco já foi calculada corretamente pelo LancamentoFormModal
            // usando dia_fechamento_fatura e dia_pagamento_fatura do cartão
            const { data, error } = await supabase
                .from('lancamentos')
                .select('*')
                .eq('conta_id', contaSelecionadaId)
                .order('data_vencimento', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!contaSelecionadaId
    });

    const contaSelecionada = contasCartao.find(c => c.id == contaSelecionadaId);

    // 2. Agrupa lançamentos por Mês/Ano da data de vencimento (1 fatura por mês)
    // A data_vencimento de cada lançamento já foi calculada corretamente pelo LancamentoFormModal
    // usando o ciclo do cartão (dia_fechamento_fatura e dia_pagamento_fatura).
    // Aqui apenas agrupamos por mês/ano para consolidar numa única fatura por período.
    const faturas = useMemo(() => {
        if (!lancamentos.length) return [];

        const grupos = {};

        lancamentos.forEach(l => {
            const vencimento = l.data_vencimento; // Ex: '2026-10-20'
            if (!vencimento) return;

            // Chave de agrupamento = YYYY-MM do vencimento
            // Garante 1 fatura por mês independente do dia exato armazenado
            const mesAno = vencimento.substring(0, 7);

            if (!grupos[mesAno]) {
                // Data oficial: usa dia_pagamento_fatura do cartão (campo real da tabela)
                // Se não encontrado, usa o dia do primeiro lançamento do grupo
                const diaPagamento = contaSelecionada?.dia_pagamento_fatura
                    ? String(contaSelecionada.dia_pagamento_fatura).padStart(2, '0')
                    : vencimento.substring(8, 10);

                grupos[mesAno] = {
                    id: mesAno,
                    data_vencimento: `${mesAno}-${diaPagamento}`,
                    itens: [],
                    total_despesas: 0,
                    total_pago: 0
                };
            }

            grupos[mesAno].itens.push(l);

            if (l.tipo === 'Despesa') {
                grupos[mesAno].total_despesas += Number(l.valor);
            } else if (l.tipo === 'Receita') {
                // Pagamentos de fatura entram como Receita no cartão
                grupos[mesAno].total_pago += Number(l.valor);
            }
        });

        // Ordena por data (mais recentes primeiro)
        return Object.values(grupos).sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
    }, [lancamentos, contaSelecionada]);

    // 3. Define o status da fatura (Aberta, Fechada, Paga, Atrasada)
    const getStatusFatura = (fatura) => {
        const saldoDevedor = fatura.total_despesas - fatura.total_pago;

        // Se a dívida é insignificante (margem de erro de centavos), está Paga
        if (saldoDevedor < 1) return { label: 'PAGA', color: 'bg-green-100 text-green-700', icon: faCheckCircle };

        const hoje = startOfDay(new Date());
        const dataVencimento = parseISO(fatura.data_vencimento);

        // Calculando data de fechamento aproximada (baseada no dia configurado na conta)
        let dataFechamento = new Date(dataVencimento);
        if (contaSelecionada?.dia_fechamento_fatura) {
            // Volta para o dia de fechamento no mês anterior ao vencimento (ou mesmo mês, dependendo da config)
            // Lógica simplificada: Se vence dia 10 e fecha dia 30, o fechamento é ~10 dias antes.
            dataFechamento.setDate(dataFechamento.getDate() - 10); // Margem de segurança padrão se não tiver config exata

            // Se tivermos os dias exatos, podemos ser precisos:
            // Ex: Vence dia 05/02. Fecha dia 25/01.
            const diaVenc = new Date(dataVencimento).getDate();
            const diaFech = contaSelecionada.dia_fechamento_fatura;

            // Recria a data de fechamento baseada no mês da fatura
            const diffMeses = diaVenc < diaFech ? 1 : 0; // Se vence antes de fechar (impossível), ajusta mês
            dataFechamento = new Date(dataVencimento);
            dataFechamento.setMonth(dataFechamento.getMonth() - diffMeses);
            dataFechamento.setDate(diaFech);
        }

        if (isBefore(dataVencimento, hoje)) {
            return { label: 'ATRASADA', color: 'bg-red-100 text-red-700', icon: faExclamationTriangle };
        } else if (isBefore(dataFechamento, hoje)) {
            return { label: 'FECHADA', color: 'bg-blue-100 text-blue-700', icon: faLock };
        } else {
            return { label: 'ABERTA', color: 'bg-yellow-100 text-yellow-700', icon: faLockOpen };
        }
    };

    const handlePagarClick = (fatura) => {
        const saldoDevedor = fatura.total_despesas - fatura.total_pago;
        setFaturaParaPagar({
            ...fatura,
            valor_restante: saldoDevedor,
            conta_cartao_id: contaSelecionadaId,
            nome_fatura: `Fatura Cartão - Venc. ${format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')}`
        });
        setIsPagamentoModalOpen(true);
    };

    const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Atualiza faturaSelecionada sempre que a lista de faturas muda ou o cartão muda
    useEffect(() => {
        if (faturas.length > 0 && (!faturaAbertaDataVencimento || !faturas.find(f => f.data_vencimento === faturaAbertaDataVencimento))) {
            // Tenta achar a primeira fatura "ABERTA" ou "ATRASADA", se não achar, pega a primeira da lista
            const faturaAtiva = faturas.find(f => {
                const s = getStatusFatura(f);
                return s.label === 'ABERTA' || s.label === 'ATRASADA';
            }) || faturas[0];

            setFaturaAbertaDataVencimento(faturaAtiva.data_vencimento);
        } else if (faturas.length === 0) {
            setFaturaAbertaDataVencimento('');
        }
    }, [faturas, contaSelecionadaId]);

    const faturaAtiva = faturas.find(f => f.data_vencimento === faturaAbertaDataVencimento);
    const statusAtiva = faturaAtiva ? getStatusFatura(faturaAtiva) : null;
    const saldoDevedorAtiva = faturaAtiva ? (faturaAtiva.total_despesas - faturaAtiva.total_pago) : 0;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Seletor de Conta e Nova Compra (Mantido igual) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="bg-orange-100 p-3 rounded-full text-orange-600 hidden md:block">
                    <FontAwesomeIcon icon={faCreditCard} size="lg" />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Cartão</label>
                    <select
                        value={contaSelecionadaId}
                        onChange={(e) => setContaSelecionadaId(e.target.value)}
                        className="w-full md:w-auto min-w-[300px] p-2 border border-gray-300 rounded-md font-medium text-gray-700 focus:ring-2 focus:ring-orange-500"
                    >
                        {contasCartao.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} (Final {c.numero_conta?.slice(-4) || '****'})</option>
                        ))}
                    </select>
                </div>

                {contaSelecionada && (
                    <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="bg-gray-50 p-2 md:p-3 rounded-lg border">
                            <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold">Limite Disponível</p>
                            <p className="text-sm md:text-lg font-bold text-gray-700">
                                {formatMoney((contaSelecionada.limite_credito || 0) + (Number(contaSelecionada.saldo_inicial) || 0))}
                            </p>
                        </div>
                        {onNewDespesaCartao && (
                            <button
                                onClick={() => onNewDespesaCartao(contaSelecionadaId)}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 md:py-3 px-4 rounded-lg shadow-sm flex items-center transition duration-200 text-sm whitespace-nowrap"
                            >
                                <FontAwesomeIcon icon={faMoneyBillWave} className="mr-2" />
                                Nova Compra
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content Área: Filtro de Mês + Extrato da Fatura */}
            {isLoading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>
            ) : faturas.length === 0 ? (
                <div className="text-center p-10 bg-gray-50 rounded-lg text-gray-500 border border-dashed">Nenhuma movimentação encontrada para este cartão.</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                    {/* COLUNA ESQUERDA: Seletor de Faturas */}
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Histórico de Faturas</h3>
                        <div className="bg-white border text-sm rounded-lg overflow-hidden flex flex-col max-h-[500px] overflow-y-auto shadow-sm">
                            {(() => {
                                const hoje = startOfDay(new Date());
                                // Fatura atual = a com menor data_vencimento >= hoje (próxima a vencer)
                                const faturaAtualId = faturas
                                    .filter(f => !isBefore(parseISO(f.data_vencimento), hoje))
                                    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0]?.id;

                                return faturas.map((f, idx) => {
                                    const s = getStatusFatura(f);
                                    const isSelected = f.data_vencimento === faturaAbertaDataVencimento;
                                    const isAtual = f.id === faturaAtualId;
                                    const dv = parseISO(f.data_vencimento);

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setFaturaAbertaDataVencimento(f.data_vencimento)}
                                            className={`text-left border-b last:border-0 transition-all flex justify-between items-center
                                                ${isAtual ? 'p-5 border-l-4 border-l-blue-500' : 'p-4 border-l-4 border-l-transparent'}
                                                ${isSelected
                                                    ? 'bg-orange-50 border-orange-200 border-l-4 border-l-orange-500'
                                                    : isAtual
                                                        ? 'bg-blue-50/60 hover:bg-blue-50'
                                                        : 'hover:bg-gray-50 bg-white'
                                                }
                                            `}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className={`font-bold ${isSelected ? 'text-orange-900' : isAtual ? 'text-blue-900' : 'text-gray-700'}`}>
                                                        {format(dv, 'MMMM / yyyy', { locale: ptBR })}
                                                    </div>
                                                    {isAtual && !isSelected && (
                                                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                            Atual
                                                        </span>
                                                    )}
                                                    {isAtual && isSelected && (
                                                        <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                            Atual
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-xs mt-1 ${isAtual ? 'text-blue-500 font-medium' : 'text-gray-500'}`}>
                                                    Vencimento {format(dv, 'dd/MM')}
                                                </div>
                                                {/* Total de despesas sempre visível para conferência */}
                                                <div className="text-xs font-semibold mt-1 text-red-500">
                                                    {formatMoney(f.total_despesas)}
                                                    {f.total_pago > 0 && (
                                                        <span className="ml-1 text-green-500 font-normal">
                                                            − {formatMoney(f.total_pago)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide shrink-0
                                                ${isSelected ? s.color : isAtual ? s.color : 'bg-gray-100 text-gray-500'}
                                            `}>
                                                {s.label}
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* COLUNA DIREITA: Extrato da Fatura Selecionada */}
                    <div className="lg:col-span-3">
                        {faturaAtiva && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                                {/* Resumo do Mês */}
                                <div className="p-6 border-b bg-gradient-to-br from-gray-50 to-white">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-800 capitalize">
                                                Fatura de {format(parseISO(faturaAtiva.data_vencimento), 'MMMM', { locale: ptBR })}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Vencimento em {format(parseISO(faturaAtiva.data_vencimento), 'dd/MM/yyyy')}
                                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusAtiva.color}`}>
                                                    <FontAwesomeIcon icon={statusAtiva.icon} className="mr-1" /> {statusAtiva.label}
                                                </span>
                                            </p>
                                        </div>

                                        {saldoDevedorAtiva > 1 && (
                                            <button
                                                onClick={() => handlePagarClick(faturaAtiva)}
                                                className="bg-gray-900 text-white hover:bg-black font-bold py-3 px-6 rounded-lg shadow-md flex items-center transition shrink-0"
                                            >
                                                Pagar Fatura
                                            </button>
                                        )}
                                    </div>

                                    {/* Cards de totais separados */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* Despesas */}
                                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                            <p className="text-[10px] text-red-500 uppercase font-bold tracking-wider mb-1">Compras / Despesas</p>
                                            <p className="text-lg font-black text-red-600">{formatMoney(faturaAtiva.total_despesas)}</p>
                                            <p className="text-[10px] text-red-400 mt-1">{faturaAtiva.itens.filter(i => i.tipo === 'Despesa').length} lançamentos</p>
                                        </div>

                                        {/* Receitas (estornos / pagamentos recebidos) */}
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                            <p className="text-[10px] text-green-600 uppercase font-bold tracking-wider mb-1">Estornos / Pagamentos</p>
                                            <p className="text-lg font-black text-green-600">{formatMoney(faturaAtiva.total_pago)}</p>
                                            <p className="text-[10px] text-green-400 mt-1">{faturaAtiva.itens.filter(i => i.tipo === 'Receita').length} lançamentos</p>
                                        </div>

                                        {/* Saldo a Pagar */}
                                        <div className={`rounded-xl p-4 border ${saldoDevedorAtiva > 0 ? 'bg-orange-50 border-orange-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                            <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${saldoDevedorAtiva > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>Saldo a Pagar</p>
                                            <p className={`text-lg font-black ${saldoDevedorAtiva > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                {formatMoney(saldoDevedorAtiva > 0 ? saldoDevedorAtiva : 0)}
                                            </p>
                                            <p className={`text-[10px] mt-1 ${saldoDevedorAtiva > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                {saldoDevedorAtiva <= 0 ? '✓ Quitada' : `= ${formatMoney(faturaAtiva.total_despesas)} − ${formatMoney(faturaAtiva.total_pago)}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Transações (Extrato) */}
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-4 font-bold">Data</th>
                                                <th scope="col" className="px-6 py-4 font-bold">Descrição da Compra</th>
                                                <th scope="col" className="px-6 py-4 font-bold text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {faturaAtiva.itens
                                                // Ordena as compras da mais recente para a mais antiga dentro do mês
                                                .sort((a, b) => new Date(b.data_transacao) - new Date(a.data_transacao))
                                                .map((item, id) => {
                                                    const isPagamento = item.tipo === 'Receita';

                                                    return (
                                                        <tr key={id} className={`border-b hover:bg-gray-50 ${isPagamento ? 'bg-green-50/30' : ''}`}>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                                {format(parseISO(item.data_transacao), 'dd/MM/yyyy')}
                                                            </td>
                                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                                {item.descricao}
                                                                {isPagamento && <span className="ml-2 text-xs text-green-600 font-bold">(Pagamento Recebido)</span>}
                                                            </td>
                                                            <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${isPagamento ? 'text-green-600' : 'text-gray-700'}`}>
                                                                {isPagamento ? '+ ' : ''}{formatMoney(item.valor)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* Modal de Pagamento */}
            <PagamentoFaturaModal
                isOpen={isPagamentoModalOpen}
                onClose={() => setIsPagamentoModalOpen(false)}
                contaCartao={contaSelecionada}
                fatura={faturaParaPagar}
                onSuccess={() => {
                    setIsPagamentoModalOpen(false);
                }}
            />
        </div>
    );
}
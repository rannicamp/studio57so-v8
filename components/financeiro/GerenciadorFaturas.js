// components/financeiro/GerenciadorFaturas.js
"use client";

import { useState, useMemo } from 'react';
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

export default function GerenciadorFaturas({ contasCartao }) {
    const supabase = createClient();
    const [contaSelecionadaId, setContaSelecionadaId] = useState(contasCartao?.[0]?.id || '');
    const [faturaParaPagar, setFaturaParaPagar] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);

    // 1. Busca lançamentos ESPECÍFICOS do cartão selecionado (sem filtros globais para ver a realidade total)
    const { data: lancamentos = [], isLoading } = useQuery({
        queryKey: ['lancamentosCartao', contaSelecionadaId],
        queryFn: async () => {
            if (!contaSelecionadaId) return [];
            // Buscamos tudo desta conta para montar o histórico de faturas
            const { data, error } = await supabase
                .from('lancamentos')
                .select('*')
                .eq('conta_id', contaSelecionadaId)
                .order('data_vencimento', { ascending: false }); // Faturas mais recentes primeiro
            
            if (error) throw error;
            return data;
        },
        enabled: !!contaSelecionadaId
    });

    const contaSelecionada = contasCartao.find(c => c.id == contaSelecionadaId);

    // 2. Agrupa lançamentos por Data de Vencimento (Faturas)
    const faturas = useMemo(() => {
        if (!lancamentos.length) return [];

        const grupos = {};
        
        lancamentos.forEach(l => {
            const vencimento = l.data_vencimento;
            if (!vencimento) return;

            if (!grupos[vencimento]) {
                grupos[vencimento] = {
                    data_vencimento: vencimento,
                    itens: [],
                    total_despesas: 0,
                    total_pago: 0
                };
            }

            grupos[vencimento].itens.push(l);
            
            if (l.tipo === 'Despesa') {
                grupos[vencimento].total_despesas += Number(l.valor);
            } else if (l.tipo === 'Receita') {
                // Pagamentos de fatura entram como Receita no cartão
                grupos[vencimento].total_pago += Number(l.valor);
            }
        });

        // Transforma objeto em array e ordena
        return Object.values(grupos).sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
    }, [lancamentos]);

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

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Seletor de Conta */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                    <FontAwesomeIcon icon={faCreditCard} size="lg" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Cartão</label>
                    <select 
                        value={contaSelecionadaId} 
                        onChange={(e) => setContaSelecionadaId(e.target.value)}
                        className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md font-medium text-gray-700 focus:ring-2 focus:ring-orange-500"
                    >
                        {contasCartao.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} (Final {c.numero_conta?.slice(-4) || '****'})</option>
                        ))}
                    </select>
                </div>
                {contaSelecionada && (
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-gray-500">Limite Disponível</p>
                        <p className="text-lg font-bold text-gray-700">
                            {formatMoney((contaSelecionada.limite_credito || 0) + (Number(contaSelecionada.saldo_inicial) || 0))}
                        </p>
                    </div>
                )}
            </div>

            {/* Lista de Faturas */}
            {isLoading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>
            ) : faturas.length === 0 ? (
                <div className="text-center p-10 bg-gray-50 rounded-lg text-gray-500">Nenhuma fatura encontrada para este cartão.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {faturas.map((fatura, idx) => {
                        const status = getStatusFatura(fatura);
                        const saldoDevedor = fatura.total_despesas - fatura.total_pago;
                        const dataVenc = parseISO(fatura.data_vencimento);

                        return (
                            <div key={idx} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${status.label === 'ATRASADA' ? 'border-red-200' : 'border-gray-200'}`}>
                                {/* Cabeçalho da Fatura */}
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.color.replace('text-', 'bg-').replace('100', '500')} text-white shadow-sm`}>
                                            <span className="text-xs font-bold">{format(dataVenc, 'MMM', { locale: ptBR }).toUpperCase()}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-sm">Vence em {format(dataVenc, 'dd/MM/yyyy')}</h4>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${status.color}`}>
                                                <FontAwesomeIcon icon={status.icon} className="mr-1" /> {status.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Corpo com Valores */}
                                <div className="p-5 space-y-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-gray-500">Total da Fatura</span>
                                        <span className="text-lg font-bold text-gray-800">{formatMoney(fatura.total_despesas)}</span>
                                    </div>
                                    
                                    {fatura.total_pago > 0 && (
                                        <div className="flex justify-between items-end text-sm text-green-600">
                                            <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCheckCircle} /> Pago</span>
                                            <span className="font-semibold">- {formatMoney(fatura.total_pago)}</span>
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-gray-100 flex justify-between items-end">
                                        <span className="text-sm font-medium text-gray-600">A Pagar</span>
                                        <span className={`text-xl font-extrabold ${saldoDevedor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatMoney(saldoDevedor > 0 ? saldoDevedor : 0)}
                                        </span>
                                    </div>
                                </div>

                                {/* Ações */}
                                {saldoDevedor > 1 && (
                                    <div className="p-3 bg-gray-50 border-t border-gray-100">
                                        <button 
                                            onClick={() => handlePagarClick(fatura)}
                                            className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
                                        >
                                            <FontAwesomeIcon icon={faMoneyBillWave} />
                                            Pagar Fatura
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                    // Atualiza a lista
                    // queryClient.invalidateQueries(['lancamentosCartao']); // Feito automaticamente pelo React Query se configurado
                }}
            />
        </div>
    );
}
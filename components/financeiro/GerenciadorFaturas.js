// components/financeiro/GerenciadorFaturas.js
"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard, faCalendarAlt, faCheckCircle, faLock,
    faLockOpen, faExclamationTriangle, faMoneyBillWave, faSpinner,
    faCloudUploadAlt, faMagic
} from '@fortawesome/free-solid-svg-icons';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PagamentoFaturaModal from './PagamentoFaturaModal';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import UppyFileImporter from '@/components/ui/UppyFileImporter';
import PanelConciliacaoCartao from './PanelConciliacaoCartao';
import { faFileAlt, faChevronDown, faChevronRight, faTrash } from '@fortawesome/free-solid-svg-icons';

export default function GerenciadorFaturas({ contasCartao, onNewDespesaCartao }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const orgId = user?.organizacao_id;
    const [contaSelecionadaId, setContaSelecionadaId] = useState(contasCartao?.filter(c => !c.conta_pai_id)?.[0]?.id || contasCartao?.[0]?.id || '');
    const [faturaParaPagar, setFaturaParaPagar] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [faturaAbertaDataVencimento, setFaturaAbertaDataVencimento] = useState('');
    const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);

    // Estados para PDF da IA
    const [isUppyOpen, setIsUppyOpen] = useState(false);
    const [isExtractingPDF, setIsExtractingPDF] = useState(false);
    const [ofxPainelAberto, setOfxPainelAberto] = useState(false); // String com a data_vencimento ou null
    const [modoConciliacaoMes, setModoConciliacaoMes] = useState(null); // Ativa o modal de conciliação para uma fatura

    // Query: Busca TODOS os Arquivos OFX/PDF da conta (incluindo filhos) para sabermos se tem arquivo importado na fatura
    const { data: arquivosOfxMes } = useQuery({
        queryKey: ['ofx_arquivos_cartao', contaSelecionadaId, orgId],
        queryFn: async () => {
            const childContas = contasCartao.filter(c => c.conta_pai_id === contaSelecionadaId);
            const accountIds = [contaSelecionadaId, ...childContas.map(c => c.id)].filter(Boolean);

            const { data, error } = await supabase
                .from('banco_arquivos_ofx')
                .select('*')
                .in('conta_id', accountIds)
                .eq('organizacao_id', orgId)
                .order('periodo_inicio', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!contaSelecionadaId && !!orgId
    });

    // Mutation: Excluir arquivo de OFX/Fatura Extraída e suas transações filhas orfãs
    const exclusaoOfxMutation = useMutation({
        mutationFn: async (arquivoId) => {
            const { error } = await supabase
                .from('banco_arquivos_ofx')
                .delete()
                .eq('id', arquivoId)
                .eq('organizacao_id', orgId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Arquivo OFX / Fatura extraída excluída!');
            queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
        },
        onError: (err) => {
            toast.error(`Erro ao excluir arquivo: ${err.message}`);
        }
    });

    const handleDeleteOfx = (e, arq) => {
        e.stopPropagation();
        if (window.confirm(`Deseja realmente excluir o arquivo "${arq.nome_arquivo}"? Todas as suas transações serão apagadas da base.`)) {
            exclusaoOfxMutation.mutate(arq.id);
        }
    };

    // 1. Busca faturas diretamente da tabela faturas_cartao (lógica de agrupamento no banco)
    //    A trigger fn_vincular_lancamento_fatura garante 1 fatura por mês automaticamente.
    const { data: faturas = [], isLoading } = useQuery({
        queryKey: ['faturasCartao', contaSelecionadaId],
        queryFn: async () => {
            if (!contaSelecionadaId) return [];

            const conta = contasCartao.find(c => c.id == contaSelecionadaId);
            const diaFech = conta?.dia_fechamento_fatura;
            const diaPag = conta?.dia_pagamento_fatura;

            // Garantir que existam faturas para os próximos 3 meses (geração automática)
            if (diaFech && diaPag && orgId) {
                const hoje = new Date();
                let dataBase = new Date(hoje);
                if (hoje.getDate() >= diaFech) {
                    dataBase.setMonth(dataBase.getMonth() + 1);
                }

                const upserts = [];
                for (let offset = 0; offset <= 3; offset++) {
                    const d = new Date(dataBase);
                    d.setMonth(d.getMonth() + offset);
                    const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    let dataVenc, dataFech;
                    if (diaPag <= diaFech) {
                        const next = new Date(d);
                        next.setMonth(next.getMonth() + 1);
                        dataVenc = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(diaPag).padStart(2, '0')}`;
                        dataFech = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(diaFech).padStart(2, '0')}`;
                    } else {
                        dataVenc = `${mesRef}-${String(diaPag).padStart(2, '0')}`;
                        dataFech = `${mesRef}-${String(diaFech).padStart(2, '0')}`;
                    }
                    upserts.push({ conta_id: Number(contaSelecionadaId), mes_referencia: mesRef, data_fechamento: dataFech, data_vencimento: dataVenc, organizacao_id: orgId });
                }

                // Upsert silencioso (ignora conflito se já existir)
                await supabase.from('faturas_cartao').upsert(upserts, { onConflict: 'conta_id,mes_referencia', ignoreDuplicates: true });
            }

            const { data, error } = await supabase
                .from('faturas_cartao')
                .select(`
                    *,
                    itens:lancamentos(
                        id, descricao, valor, tipo, status,
                        data_transacao, data_vencimento, data_pagamento,
                        categoria_id, transferencia_id
                    )
                `)
                .eq('conta_id', contaSelecionadaId)
                .order('data_vencimento', { ascending: false });

            if (error) throw error;

            // Calcular totais localmente com base nos lançamentos já vinculados
            return (data || []).map(f => ({
                ...f,
                itens: f.itens || [],
                total_despesas: (f.itens || []).filter(i => i.tipo === 'Despesa').reduce((s, i) => s + Number(i.valor), 0),
                total_pago: (f.itens || []).filter(i => i.tipo === 'Receita').reduce((s, i) => s + Number(i.valor), 0),
            }));
        },
        enabled: !!contaSelecionadaId
    });

    const contaSelecionada = contasCartao.find(c => c.id == contaSelecionadaId);

    // 3. Define o status da fatura (Aberta, Fechada, Paga, Atrasada)
    const getStatusFatura = (fatura) => {
        const saldoDevedor = fatura.total_despesas - fatura.total_pago;

        // Se a dívida é insignificante (margem de erro de centavos), está Paga
        if (saldoDevedor < 1) return { label: 'PAGA', color: 'bg-green-100 text-green-700', icon: faCheckCircle };

        const hoje = startOfDay(new Date());
        const dataVencimento = parseISO(fatura.data_vencimento);
        const dataFechamento = fatura.data_fechamento ? parseISO(fatura.data_fechamento) : null;

        if (isBefore(dataVencimento, hoje)) {
            return { label: 'ATRASADA', color: 'bg-red-100 text-red-700', icon: faExclamationTriangle };
        } else if (dataFechamento && isBefore(dataFechamento, hoje)) {
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

    const handlePdfUpload = async (file) => {
        setIsUppyOpen(false);
        if (!file) return;

        setIsExtractingPDF(true);
        const toastId = toast.loading('Lendo Fatura com Inteligência Artificial...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/cartoes/extrair-fatura', {
                method: 'POST',
                body: formData
            });

            // --- PROTOCOLO ANTI-CRASH (Início) ---
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") === -1) {
                const errorText = await res.text();
                console.error(`O Servidor retornou um erro não-JSON na fatura ${file.name}:`, errorText);
                throw new Error('O servidor demorou muito para processar a fatura ou retornou um erro inesperado. Tente novamente mais tarde.');
            }
            
            let result;
            try {
                result = await res.json();
            } catch (parseErr) {
                console.error(`Erro ao converter JSON na fatura ${file.name}:`, parseErr);
                throw new Error('Erro ao ler a resposta da inteligência artificial. Tente novamente.');
            }
            // --- PROTOCOLO ANTI-CRASH (Fim) ---

            if (!res.ok) throw new Error(result.error || 'Falha ao extrair dados do PDF.');

            let accountsInjected = 0;
            toast.loading('Injetando transações geradas via IA no banco seguro...', { id: toastId });

            if (result.extratos && result.extratos.length > 0) {
                for (const extrato of result.extratos) {
                    const finalDigits = extrato.cartao_final ? String(extrato.cartao_final).trim() : '';
                    let matchedContaId = contaSelecionadaId;

                    if (finalDigits.length >= 4) {
                        const found = contasCartao.find(c => c.numero_conta && String(c.numero_conta).endsWith(finalDigits));
                        if (found) matchedContaId = found.id;
                    }

                    if (!matchedContaId || !extrato.lancamentos || extrato.lancamentos.length === 0) continue;

                    // Busca a data de vencimento extraida pela IA
                    const dataVencimentoIA = extrato.data_vencimento_fatura || faturaAtiva?.data_vencimento || result.extratos[0]?.lancamentos[0]?.data_transacao;
                    if (!dataVencimentoIA) continue;

                    // 1. Título do arquivo de rascunho.
                    const nomeArq = `Fatura_Virtual_Cartao_${finalDigits || 'Desconhecido'}_Venc_${dataVencimentoIA}.pdf`;

                    // Remove rascunho anterior pra evitar sujar se a pessoa enviar a mesma fatura de novo
                    await supabase.from('banco_arquivos_ofx').delete()
                        .eq('conta_id', matchedContaId).eq('nome_arquivo', nomeArq).eq('organizacao_id', orgId);

                    const { data: arqHeader, error: arqError } = await supabase.from('banco_arquivos_ofx').insert({
                        organizacao_id: orgId, conta_id: matchedContaId,
                        nome_arquivo: nomeArq, status: 'Processado IA',
                        periodo_inicio: dataVencimentoIA, periodo_fim: dataVencimentoIA
                    }).select('*').single();

                    if (arqError) { console.error('Erro OFX Header:', arqError); continue; }

                    // 2. Transações com FITID customizado e forte
                    const payloadTransacoes = extrato.lancamentos.map((l, index) => {
                        const safeDateTrans = l.data_transacao || dataVencimentoIA;
                        const dateTransStr = safeDateTrans.replace(/-/g, '');
                        const dateVencStr = dataVencimentoIA.replace(/-/g, '');
                        const tipoLetra = l.tipo === 'Despesa' ? 'D' : 'R';
                        
                        // FITID Robusto: Conta - Vcto - Compra - Valor - Tipo - IndexSegurancaDaLinha
                        const fitidFormatado = `CC-${finalDigits || '0000'}-${dateVencStr}-${dateTransStr}-${l.valor}-${tipoLetra}-${index}`;

                        return {
                            fitid: fitidFormatado,
                            arquivo_id: arqHeader.id, organizacao_id: orgId, conta_id: matchedContaId,
                            data_transacao: safeDateTrans,
                            valor: l.tipo === 'Despesa' ? -Math.abs(l.valor) : Math.abs(l.valor), // Despesas OFX são negativas
                            tipo: l.tipo,
                            descricao_banco: l.descricao || 'Compra Cartão',
                            memo_banco: `Fatura Proc. IA: ${extrato.titular || 'Titular'}`
                        };
                    });

                    if (payloadTransacoes.length > 0) {
                        const { error: trError } = await supabase.from('banco_transacoes_ofx').upsert(payloadTransacoes, { onConflict: 'fitid' });
                        if (!trError) {
                            accountsInjected++;
                            // Força a aba pular pro mês que a IA leu
                            if (dataVencimentoIA !== faturaAbertaDataVencimento) {
                                setFaturaAbertaDataVencimento(dataVencimentoIA);
                            }
                        }
                    }
                }
            }

            toast.success(`Leitura concluída! ${accountsInjected} sub-cartão(ões) injetado(s) com sucesso.`, { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
            
            // Pergunta amigável se quer abrir a conciliação logo ou deixa lá no painel.
            toast('Deseja conciliar a fatura agora?', {
                id: toastId, // Substituir o toast de loading para este
                action: {
                    label: 'Sim, Conciliar',
                    onClick: () => setModoConciliacaoMes(faturaAtiva.data_vencimento)
                },
                cancel: {
                    label: 'Depois'
                },
                duration: 10000
            });
            
        } catch (error) {
            console.error('Erro de extração:', error);
            toast.error(error.message || 'Ocorreu um erro ao chamar a IA do Gemini.', { id: toastId });
        } finally {
            setIsExtractingPDF(false);
        }
    };

    if (modoConciliacaoMes) {
        return (
            <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-sm mb-4">
                    <div>
                        <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                            <FontAwesomeIcon icon={faMagic} className="text-indigo-500" /> Conciliação Inteligente de Fatura IA
                        </h2>
                        <p className="text-sm text-indigo-600 font-semibold mt-1">Conecte as despesas identificadas pela Inteligência Artificial com os lançamentos efetuados no sistema.</p>
                    </div>
                    <button 
                        onClick={() => setModoConciliacaoMes(null)}
                        className="px-6 py-2.5 bg-white border border-gray-300 shadow hover:bg-gray-50 text-gray-800 font-bold rounded-xl transition"
                    >
                        Concluir e Voltar
                    </button>
                </div>
                {/* Aqui entregamos a lista de cartões e o cartão que estava ativamente selecionado */}
                <PanelConciliacaoCartao contas={contasCartao} initialContaId={contaSelecionadaId} faturaVencimento={modoConciliacaoMes} />
            </div>
        );
    }

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
                        {contasCartao.filter(c => !c.conta_pai_id).map(c => (
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

                                    const ofxDestaFatura = (arquivosOfxMes || []).filter(a => a.periodo_inicio === f.data_vencimento);
                                    const ofxAberto = ofxPainelAberto === f.data_vencimento;

                                    return (
                                        <div key={idx} className="border-b last:border-0 transition-all">
                                            <div className={`flex justify-between items-center ${isAtual ? 'p-5 border-l-4 border-l-blue-500' : 'p-4 border-l-4 border-l-transparent'}
                                                ${isSelected ? 'bg-orange-50 border-orange-200 border-l-4 border-l-orange-500' : isAtual ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}
                                            >
                                                <button
                                                    onClick={() => { setFaturaAbertaDataVencimento(f.data_vencimento); setModoConciliacaoMes(null); }}
                                                    className="flex-1 text-left"
                                                >
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
                                                        Fecha {f.data_fechamento ? format(parseISO(f.data_fechamento), 'dd/MM') : '--'} | Vence {format(dv, 'dd/MM')}
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
                                                </button>

                                                <div className="flex flex-col items-end gap-2">
                                                    <div className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide shrink-0
                                                        ${isSelected ? s.color : isAtual ? s.color : 'bg-gray-100 text-gray-500'}
                                                    `}>
                                                        {s.label}
                                                    </div>
                                                    {ofxDestaFatura.length > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setModoConciliacaoMes(f.data_vencimento); }}
                                                                className={`px-3 py-1 text-xs font-bold rounded border shadow-sm transition-all
                                                                    ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                                                            >
                                                                Conciliar
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setOfxPainelAberto(ofxAberto ? null : f.data_vencimento); }}
                                                                className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] font-bold 
                                                                    ${ofxAberto ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:bg-gray-100'}`}
                                                                title="Expandir PDFs Importados"
                                                            >
                                                                <FontAwesomeIcon icon={faFileAlt} />
                                                                <span>{ofxDestaFatura.length}</span>
                                                                <FontAwesomeIcon icon={ofxAberto ? faChevronDown : faChevronRight} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sub-lista de arquivos importados da IA */}
                                            {ofxAberto && ofxDestaFatura.length > 0 && (
                                                <div className="bg-indigo-50/60 border-t border-indigo-100 px-3 py-2 flex flex-col gap-1.5">
                                                    {ofxDestaFatura.map(arq => (
                                                        <div
                                                            key={arq.id}
                                                            className={`w-full group rounded-lg border transition-all flex items-stretch overflow-hidden bg-white/70 border-indigo-100 hover:border-indigo-300`}
                                                        >
                                                            <div className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 min-w-0">
                                                                <FontAwesomeIcon icon={faFileAlt} className={`flex-shrink-0 text-xs text-indigo-400`} />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-bold text-gray-800 truncate text-[11px]" title={arq.nome_arquivo}>{arq.nome_arquivo}</p>
                                                                    <p className="text-[9px] text-gray-400">Inserido em {format(parseISO(arq.created_at), 'dd/MM/yy HH:mm')}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDeleteOfx(e, arq)}
                                                                className="px-3 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-transparent group-hover:border-indigo-100"
                                                                title="Apagar dados extraídos desta fatura"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                                            <p className="text-sm font-medium mt-1">
                                                <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded mr-2 border border-orange-100">
                                                    Fechamento em {faturaAtiva.data_fechamento ? format(parseISO(faturaAtiva.data_fechamento), 'dd/MM/yyyy') : '--'}
                                                </span>
                                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                    Vencimento em {format(parseISO(faturaAtiva.data_vencimento), 'dd/MM/yyyy')}
                                                </span>
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusAtiva.color}`}>
                                                    <FontAwesomeIcon icon={statusAtiva.icon} className="mr-1" /> {statusAtiva.label}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            {saldoDevedorAtiva > 1 && (
                                                <button
                                                    onClick={() => handlePagarClick(faturaAtiva)}
                                                    className="bg-gray-900 text-white hover:bg-black font-bold py-3 px-6 rounded-lg shadow-md flex items-center transition shrink-0"
                                                >
                                                    Pagar Fatura
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setIsUppyOpen(true)}
                                                disabled={isExtractingPDF}
                                                className={`py-3 px-6 rounded-lg shadow-md font-bold flex items-center transition shrink-0 ${isExtractingPDF ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                                            >
                                                {isExtractingPDF ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : <FontAwesomeIcon icon={faCloudUploadAlt} className="mr-2" />}
                                                Importar PDF
                                            </button>
                                        </div>
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
                                                        <tr
                                                            key={id}
                                                            onClick={() => setLancamentoSelecionado(item)}
                                                            className={`border-b cursor-pointer hover:bg-orange-50 transition-colors ${isPagamento ? 'bg-green-50/30 hover:bg-green-50' : ''
                                                                }`}
                                                        >
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
                    queryClient.invalidateQueries({ queryKey: ['faturasCartao', contaSelecionadaId] });
                    setIsPagamentoModalOpen(false);
                }}
            />

            {/* Sidebar de Detalhes do Lançamento */}
            <LancamentoDetalhesSidebar
                open={!!lancamentoSelecionado}
                onClose={() => setLancamentoSelecionado(null)}
                lancamento={lancamentoSelecionado}
            />

            {/* Uploader Uppy PDF Gemini */}
            <UppyFileImporter
                isOpen={isUppyOpen}
                onClose={() => setIsUppyOpen(false)}
                onFileSelected={handlePdfUpload}
                title="Importar Fatura em PDF"
                allowedFileTypes={['.pdf']}
                note="A nossa IA (Gemini) vai ler o seu PDF e extrair os lançamentos."
                multiple={false}
            />
        </div>
    );
}
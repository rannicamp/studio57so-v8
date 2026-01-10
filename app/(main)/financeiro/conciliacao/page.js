// app/(main)/financeiro/conciliacao/page.js
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBank, faTrash, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import Papa from 'papaparse'; 
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// --- IMPORTAÇÕES ---
import ExtratoUploader from '../../../../components/financeiro/conciliacao/ExtratoUploader';
import ConciliacaoWorkbench from '../../../../components/financeiro/conciliacao/ConciliacaoWorkbench';
import LancamentoFormModal from '../../../../components/financeiro/LancamentoFormModal'; 

// --- FUNÇÃO DE LIMPEZA DE DATA BLINDADA ---
const normalizarData = (dataRaw) => {
    if (!dataRaw) return format(new Date(), 'yyyy-MM-dd');

    const str = dataRaw.trim();
    
    // 1. Já está no formato certo? (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // 2. Formato Brasileiro com barras ou traços (DD/MM/AAAA ou DD-MM-YY)
    const matchBR = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    
    if (matchBR) {
        const dia = matchBR[1].padStart(2, '0');
        const mes = matchBR[2].padStart(2, '0');
        let ano = matchBR[3];

        // Se o ano for curto (ex: 25), assume século 2000 (2025)
        if (ano.length === 2) {
            ano = `20${ano}`;
        }
        
        return `${ano}-${mes}-${dia}`;
    }

    console.warn("Data não reconhecida:", dataRaw);
    return format(new Date(), 'yyyy-MM-dd');
};

// --- PARSERS ---
const parseOFX = (ofxString) => {
    const transactions = [];
    const lines = ofxString.split('\n');
    let currentTrx = {};
    
    lines.forEach(line => {
        if(line.includes('<STMTTRN>')) currentTrx = {};
        if(line.includes('<TRNTYPE>')) currentTrx.tipo = line.split('>')[1].split('<')[0] === 'CREDIT' ? 'CREDIT' : 'DEBIT';
        if(line.includes('<DTPOSTED>')) {
            const rawDate = line.split('>')[1].split('<')[0];
            const year = rawDate.substring(0,4);
            const month = rawDate.substring(4,6);
            const day = rawDate.substring(6,8);
            currentTrx.data = `${year}-${month}-${day}`;
        }
        if(line.includes('<TRNAMT>')) currentTrx.valor = Math.abs(parseFloat(line.split('>')[1].split('<')[0]));
        if(line.includes('<MEMO>')) currentTrx.descricao = line.split('>')[1].split('<')[0];
        if(line.includes('</STMTTRN>')) {
            currentTrx.id = Math.random().toString(36).substr(2, 9);
            currentTrx.conciliado = false;
            if(currentTrx.valor) transactions.push(currentTrx);
        }
    });
    return transactions;
};

const parseCSV = (csvString) => {
    const results = Papa.parse(csvString, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: h => h.trim() 
    });

    return results.data.map((row, index) => {
        const keys = Object.keys(row);
        const dateKey = keys.find(k => /data|date|dt|dia/i.test(k));
        const descKey = keys.find(k => /descri|memo|hist|texto/i.test(k));
        const valueKey = keys.find(k => /valor|amount|vlr|saldo/i.test(k));
        
        if (!dateKey || !valueKey) return null;

        let valorRaw = row[valueKey];
        let valor = 0;
        if (typeof valorRaw === 'string') {
            valorRaw = valorRaw.replace('R$', '').trim();
            if (valorRaw.includes(',') && !valorRaw.includes('.')) {
                valor = parseFloat(valorRaw.replace(',', '.'));
            } else if (valorRaw.includes('.') && valorRaw.includes(',')) {
                valor = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));
            } else {
                valor = parseFloat(valorRaw);
            }
        } else {
            valor = parseFloat(valorRaw);
        }

        const dataRaw = row[dateKey];
        const dataFormatada = normalizarData(dataRaw);

        return {
            id: `csv-${index}-${Math.random().toString(36).substr(2, 9)}`,
            data: dataFormatada, 
            descricao: row[descKey] || 'Sem descrição',
            valor: Math.abs(valor),
            tipo: valor < 0 ? 'DEBIT' : 'CREDIT', 
            conciliado: false
        };
    }).filter(item => item !== null && !isNaN(item.valor));
};

export default function ConciliacaoPage() {
    const supabase = createClient();
    const { user } = useAuth();
    
    // Estados
    const [contaSelecionada, setContaSelecionada] = useState(null);
    const [extratoItems, setExtratoItems] = useState([]);
    
    // Filtros
    const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    
    const [isLoaded, setIsLoaded] = useState(false); 

    // Edição/Criação
    const [lancamentoParaEditar, setLancamentoParaEditar] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [itemEmCriacao, setItemEmCriacao] = useState(null);

    // Carregar Cache
    useEffect(() => {
        try {
            const savedConta = sessionStorage.getItem('conciliacao_conta');
            const savedExtrato = sessionStorage.getItem('conciliacao_extrato');
            const savedDataInicio = sessionStorage.getItem('conciliacao_dataInicio');
            const savedDataFim = sessionStorage.getItem('conciliacao_dataFim');
            
            if (savedConta) setContaSelecionada(JSON.parse(savedConta));
            if (savedExtrato) setExtratoItems(JSON.parse(savedExtrato));
            if (savedDataInicio) setDataInicio(savedDataInicio);
            if (savedDataFim) setDataFim(savedDataFim);

        } catch (e) { console.error("Erro sessão:", e); } 
        finally { setIsLoaded(true); }
    }, []);

    // Salvar Cache
    useEffect(() => {
        if (!isLoaded) return;
        if (contaSelecionada) sessionStorage.setItem('conciliacao_conta', JSON.stringify(contaSelecionada));
        else sessionStorage.removeItem('conciliacao_conta');
    }, [contaSelecionada, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        if (extratoItems.length > 0) sessionStorage.setItem('conciliacao_extrato', JSON.stringify(extratoItems));
        else sessionStorage.removeItem('conciliacao_extrato');
    }, [extratoItems, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        sessionStorage.setItem('conciliacao_dataInicio', dataInicio);
        sessionStorage.setItem('conciliacao_dataFim', dataFim);
    }, [dataInicio, dataFim, isLoaded]);

    // Queries
    const { data: contas = [] } = useQuery({
        queryKey: ['contas_conciliacao', user?.organizacao_id],
        queryFn: async () => {
            const { data } = await supabase.from('contas_financeiras').select('*').eq('organizacao_id', user?.organizacao_id);
            return data || [];
        },
        enabled: !!user?.organizacao_id
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ['empresas_conciliacao', user?.organizacao_id],
        queryFn: async () => {
            const { data } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', user?.organizacao_id);
            return data || [];
        },
        enabled: !!user?.organizacao_id
    });

    // --- QUERY PRINCIPAL INTELIGENTE ---
    const { data: sistemaItems = [], refetch: refetchSistema } = useQuery({
        queryKey: ['lancamentos_sistema', contaSelecionada?.id, dataInicio, dataFim],
        queryFn: async () => {
            if(!contaSelecionada) return [];
            
            const isCartao = contaSelecionada.tipo === 'Cartão de Crédito';
            
            // 1. Definição da Coluna de Busca
            // Se for Cartão -> Busca por Transação (Data da compra)
            // Se for Outros -> Busca por Vencimento (Fluxo normal) 
            // *Nota: Poderíamos buscar por pagamento também, mas vencimento cobre o planejado e o realizado geralmente cai no mesmo mês.
            const colunaBusca = isCartao ? 'data_transacao' : 'data_vencimento';

            let query = supabase
                .from('lancamentos')
                .select('*') 
                .eq('conta_id', contaSelecionada.id)
                .gte(colunaBusca, dataInicio)
                .lte(colunaBusca, dataFim)
                .order(colunaBusca, { ascending: false });

            const { data } = await query;

            // 2. Definição da Data Visual (Sua Regra de Ouro)
            return data?.map(d => {
                let dataVisual = null;

                if (isCartao) {
                    // REGRA 1: Cartão sempre usa data da transação
                    dataVisual = d.data_transacao;
                } else {
                    // REGRA 2: Outros tipos de conta
                    if ((d.status === 'Pago' || d.status === 'Conciliado') && d.data_pagamento) {
                        dataVisual = d.data_pagamento; // 1º Pagamento
                    } else if (d.data_vencimento) {
                        dataVisual = d.data_vencimento; // 2º Vencimento
                    } else {
                        dataVisual = d.data_transacao; // 3º Transação
                    }
                }

                // Fallback
                if (!dataVisual) dataVisual = d.data_transacao;

                return {
                    ...d,
                    id: d.id,
                    data: dataVisual, // DATA CORRETA APLICADA
                    descricao: d.descricao,
                    valor: d.valor,
                    tipo: d.tipo, 
                    conciliado: d.status === 'Conciliado' || d.conciliado === true 
                };
            }) || [];
        },
        enabled: !!contaSelecionada && !!dataInicio && !!dataFim
    });

    // Actions
    const handleFileLoaded = ({ content, extension }) => {
        try {
            let parsed = [];
            if (extension === 'ofx') parsed = parseOFX(content);
            else if (extension === 'csv') parsed = parseCSV(content);
            else throw new Error("Formato não suportado.");

            if(parsed.length === 0) throw new Error("Nenhuma transação válida encontrada.");
            
            setExtratoItems(parsed);

            const datasOrdenadas = parsed.map(p => p.data).sort((a, b) => a.localeCompare(b)); 
            
            if (datasOrdenadas.length > 0) {
                const menorData = datasOrdenadas[0];
                const maiorData = datasOrdenadas[datasOrdenadas.length - 1];
                setDataInicio(menorData);
                setDataFim(maiorData);
                toast.success(`${parsed.length} linhas! Período ajustado.`);
            } else {
                toast.success(`${parsed.length} transações carregadas!`);
            }

        } catch (e) {
            toast.error("Erro ao ler arquivo: " + e.message);
        }
    };

    const handleConciliar = async (banco, sistema) => {
        setExtratoItems(prev => prev.filter(i => i.id !== banco.id));
        try {
            const { error } = await supabase
                .from('lancamentos')
                .update({ 
                    status: 'Conciliado', 
                    conciliado: true,
                    // Se for cartão, não mexe na data de pagamento (pois paga na fatura)
                    data_pagamento: contaSelecionada.tipo === 'Cartão de Crédito' ? null : banco.data 
                })
                .eq('id', sistema.id);

            if (error) throw error;
            toast.success("Conciliado!");
            refetchSistema();
        } catch (error) {
            toast.error("Erro ao salvar.");
        }
    };

    // --- CRIAÇÃO COM DATA ESPERTA ---
    const handleCriarLancamento = (itemBanco) => {
        const dataExtrato = normalizarData(itemBanco.data);

        // Se for cartão, a data do extrato é a data da transação.
        // Se for conta corrente, a data do extrato é o efetivo pagamento.
        const isCartao = contaSelecionada?.tipo === 'Cartão de Crédito';

        const novoLancamento = {
            conta_id: contaSelecionada?.id,
            descricao: itemBanco.descricao,
            valor: Math.abs(itemBanco.valor),
            tipo: (itemBanco.tipo === 'CREDIT' || itemBanco.valor > 0) ? 'Receita' : 'Despesa',
            
            data_transacao: dataExtrato, 
            data_vencimento: dataExtrato, 
            
            // Se for cartão, não preenche pagamento agora. Se for conta, já nasce pago na data do extrato.
            data_pagamento: isCartao ? null : dataExtrato,
            
            status: isCartao ? 'Pendente' : 'Conciliado', // Cartão nasce pendente (fatura). Conta nasce conciliado.
            conciliado: true,
            id_transacao_externa: itemBanco.id
        };

        setItemEmCriacao(itemBanco);
        setLancamentoParaEditar(novoLancamento);
        setIsEditModalOpen(true);
    };

    const handleLimparSessao = () => {
        if(confirm("Deseja limpar o extrato importado?")) {
            setExtratoItems([]);
            sessionStorage.removeItem('conciliacao_extrato');
            toast.success("Limpo.");
        }
    }
    
    const handleEditarLancamento = (item) => {
        setLancamentoParaEditar(item);
        setIsEditModalOpen(true);
    };

    const handleSaveEdicao = () => {
        setIsEditModalOpen(false);
        setLancamentoParaEditar(null);
        
        if (itemEmCriacao) {
            setExtratoItems(prev => prev.filter(i => i.id !== itemEmCriacao.id));
            setItemEmCriacao(null);
            toast.success("Lançamento criado e conciliado!");
        }
        
        refetchSistema(); 
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setItemEmCriacao(null);
    };

    if (!isLoaded) return null; 

    return (
        <div className="h-full flex flex-col p-4 md:p-6 space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600 transition">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Conciliação Bancária</h1>
                            <p className="text-sm text-gray-500">Conferência de extratos e baixa de lançamentos</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {extratoItems.length > 0 && (
                            <button onClick={handleLimparSessao} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition" title="Limpar extrato">
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        )}
                        <div className="w-64">
                            <select 
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                onChange={(e) => {
                                    const conta = contas.find(c => c.id.toString() === e.target.value);
                                    setContaSelecionada(conta);
                                    setExtratoItems([]); 
                                }}
                                value={contaSelecionada?.id || ''}
                            >
                                <option value="">Selecione uma conta...</option>
                                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {contaSelecionada && (
                    <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100 animate-fade-in transition-all">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faCalendarAlt} /> Período do Sistema:
                        </span>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={dataInicio} 
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="p-1.5 border border-gray-300 rounded text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors focus:border-blue-400"
                            />
                            <span className="text-gray-400 text-sm">até</span>
                            <input 
                                type="date" 
                                value={dataFim} 
                                onChange={(e) => setDataFim(e.target.value)}
                                className="p-1.5 border border-gray-300 rounded text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors focus:border-blue-400"
                            />
                        </div>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded ml-auto">
                            Exibindo: {sistemaItems.length} lançamentos
                        </span>
                    </div>
                )}
            </div>

            {!contaSelecionada ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <FontAwesomeIcon icon={faBank} className="text-4xl mb-4 opacity-50" />
                    <p>Selecione uma conta acima para iniciar</p>
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in flex-1 flex flex-col">
                    {extratoItems.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-full max-w-2xl">
                                <ExtratoUploader onFileLoaded={handleFileLoaded} />
                            </div>
                        </div>
                    ) : (
                        <ConciliacaoWorkbench 
                            extratoItems={extratoItems}
                            sistemaItems={sistemaItems}
                            onConciliar={handleConciliar}
                            onCriarLancamento={handleCriarLancamento}
                            onEditarLancamento={handleEditarLancamento} 
                        />
                    )}
                </div>
            )}
            
            <LancamentoFormModal
                isOpen={isEditModalOpen}
                onClose={handleCloseModal}
                initialData={lancamentoParaEditar}
                onSuccess={handleSaveEdicao}
                empresas={empresas}
            />
        </div>
    );
}
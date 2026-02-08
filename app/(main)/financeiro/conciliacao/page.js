// app/(main)/financeiro/conciliacao/page.js
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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

// --- HELPER: GERAÇÃO DE ID ÚNICO (ASSINATURA DIGITAL) ---
const gerarHashTransacao = (data, valor, descricao) => {
    const descLimpa = descricao ? descricao.trim().toLowerCase().replace(/\s+/g, '-') : 'sem-desc';
    const valStr = parseFloat(valor).toFixed(2);
    return `${data}_${valStr}_${descLimpa}`;
};

// --- HELPER: DATAS ---
const normalizarData = (dataRaw) => {
    if (!dataRaw) return format(new Date(), 'yyyy-MM-dd');
    const str = dataRaw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const matchBR = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (matchBR) {
        const dia = matchBR[1].padStart(2, '0');
        const mes = matchBR[2].padStart(2, '0');
        let ano = matchBR[3];
        if (ano.length === 2) ano = `20${ano}`;
        return `${ano}-${mes}-${dia}`;
    }
    return format(new Date(), 'yyyy-MM-dd');
};

// --- PARSER OFX CORRIGIDO PARA CAIXA (Regex Robusto) ---
const parseOFX = (ofxString) => {
    const transactions = [];
    
    // 1. Limpeza: Ignora o cabeçalho textual da Caixa (antes de <OFX>)
    const startIndex = ofxString.indexOf('<OFX>');
    const content = startIndex !== -1 ? ofxString.substring(startIndex) : ofxString;

    // 2. Regex para capturar cada bloco <STMTTRN>...</STMTTRN>
    // [\s\S]*? pega tudo, inclusive quebras de linha, até fechar a tag
    const regexTransaction = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    
    let match;
    while ((match = regexTransaction.exec(content)) !== null) {
        const block = match[1]; // O conteúdo dentro da transação

        // Helper para extrair valor de uma tag específica dentro do bloco
        const getValue = (tag) => {
            const rx = new RegExp(`<${tag}>([^<]*)`, 'i');
            const m = rx.exec(block);
            return m ? m[1].trim() : null;
        };

        const tipoRaw = getValue('TRNTYPE');
        const dtPosted = getValue('DTPOSTED');
        const valorRaw = getValue('TRNAMT');
        const fitid = getValue('FITID');
        const memo = getValue('MEMO') || getValue('NAME');

        // Tratamento da Data (YYYYMMDD...)
        let dataFinal = null;
        if (dtPosted && dtPosted.length >= 8) {
            const y = dtPosted.substring(0, 4);
            const m = dtPosted.substring(4, 6);
            const d = dtPosted.substring(6, 8);
            dataFinal = `${y}-${m}-${d}`;
        }

        // Tratamento do Valor
        const valor = valorRaw ? Math.abs(parseFloat(valorRaw)) : 0;
        const tipo = (tipoRaw === 'CREDIT') ? 'CREDIT' : 'DEBIT';

        // Lógica do ID (FITID ou Hash)
        let finalId;
        if (fitid && fitid !== '0' && !/^0+$/.test(fitid)) {
            finalId = fitid;
        } else {
            // Se o FITID for inválido (comum na Caixa), gera hash
            finalId = gerarHashTransacao(dataFinal, tipo === 'DEBIT' ? -valor : valor, memo);
        }

        if (dataFinal && !isNaN(valor)) {
            transactions.push({
                id: finalId,
                fitidRaw: fitid,
                data: dataFinal,
                valor: valor,
                descricao: memo || 'Sem descrição',
                tipo: tipo,
                conciliado: false
            });
        }
    }
    
    return transactions;
};

const parseCSV = (csvString) => {
    const results = Papa.parse(csvString, { 
        header: true, skipEmptyLines: true, transformHeader: h => h.trim() 
    });

    return results.data.map((row) => {
        const keys = Object.keys(row);
        const dateKey = keys.find(k => /data|date|dt|dia/i.test(k));
        const descKey = keys.find(k => /descri|memo|hist|texto/i.test(k));
        const valueKey = keys.find(k => /valor|amount|vlr|saldo/i.test(k));
        
        if (!dateKey || !valueKey) return null;

        let valorRaw = row[valueKey];
        let valor = 0;
        let valorOriginal = 0;

        if (typeof valorRaw === 'string') {
            valorRaw = valorRaw.replace('R$', '').trim();
            if (valorRaw.includes(',') && !valorRaw.includes('.')) {
                valorOriginal = parseFloat(valorRaw.replace(',', '.'));
            } else if (valorRaw.includes('.') && valorRaw.includes(',')) {
                valorOriginal = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));
            } else {
                valorOriginal = parseFloat(valorRaw);
            }
        } else {
            valorOriginal = parseFloat(valorRaw);
        }
        valor = Math.abs(valorOriginal);

        const dataFormatada = normalizarData(row[dateKey]);
        const descricao = row[descKey] || 'Sem descrição';
        const finalId = gerarHashTransacao(dataFormatada, valorOriginal, descricao);

        return {
            id: finalId,
            data: dataFormatada, 
            descricao: descricao,
            valor: valor,
            tipo: valorOriginal < 0 ? 'DEBIT' : 'CREDIT', 
            conciliado: false
        };
    }).filter(item => item !== null && !isNaN(item.valor));
};

export default function ConciliacaoPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
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

    // Carregar Cache Inicial
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

    // Persistência de Cache
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

    // --- QUERY PRINCIPAL DO SISTEMA ---
    const { data: sistemaItems = [], refetch: refetchSistema } = useQuery({
        queryKey: ['lancamentos_sistema', contaSelecionada?.id, dataInicio, dataFim],
        queryFn: async () => {
            if(!contaSelecionada) return [];
            
            const isCartao = contaSelecionada.tipo === 'Cartão de Crédito';
            const colunaBusca = isCartao ? 'data_transacao' : 'data_vencimento';

            let query = supabase
                .from('lancamentos')
                .select('*, fitid') 
                .eq('conta_id', contaSelecionada.id)
                .gte(colunaBusca, dataInicio)
                .lte(colunaBusca, dataFim)
                .order(colunaBusca, { ascending: false });

            const { data } = await query;

            return data?.map(d => {
                let dataVisual = null;
                if (isCartao) {
                    dataVisual = d.data_transacao;
                } else {
                    if ((d.status === 'Pago' || d.status === 'Conciliado') && d.data_pagamento) {
                        dataVisual = d.data_pagamento;
                    } else if (d.data_vencimento) {
                        dataVisual = d.data_vencimento;
                    } else {
                        dataVisual = d.data_transacao;
                    }
                }
                if (!dataVisual) dataVisual = d.data_transacao;

                return {
                    ...d,
                    id: d.id,
                    data: dataVisual,
                    descricao: d.descricao,
                    valor: d.valor,
                    tipo: d.tipo, 
                    conciliado: d.status === 'Conciliado' || d.conciliado === true 
                };
            }) || [];
        },
        enabled: !!contaSelecionada && !!dataInicio && !!dataFim
    });

    // --- AUTO-CONCILIAÇÃO VISUAL ---
    useEffect(() => {
        if (extratoItems.length > 0 && sistemaItems.length > 0) {
            const fitidsNoBanco = new Set(
                sistemaItems
                    .filter(item => item.fitid)
                    .map(item => String(item.fitid))
            );

            let houveMudanca = false;
            
            const extratoAtualizado = extratoItems.map(itemExtrato => {
                if (fitidsNoBanco.has(String(itemExtrato.id))) {
                    if (!itemExtrato.conciliado) {
                        houveMudanca = true;
                        return { ...itemExtrato, conciliado: true };
                    }
                }
                return itemExtrato;
            });

            if (houveMudanca) {
                setExtratoItems(extratoAtualizado);
                toast.success("Itens já existentes foram marcados automaticamente.");
            }
        }
    }, [sistemaItems, extratoItems]);

    // --- ACTIONS ---

    const handleFileLoaded = ({ content, extension }) => {
        try {
            let parsed = [];
            // O ExtratoUploader já trata a codificação (UTF8/ISO) e manda o 'content' limpo
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
                toast.success(`${parsed.length} linhas carregadas!`);
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
                    data_pagamento: contaSelecionada.tipo === 'Cartão de Crédito' ? null : banco.data,
                    fitid: banco.id 
                })
                .eq('id', sistema.id);

            if (error) throw error;
            toast.success("Conciliado!");
            refetchSistema();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        }
    };

    const handleCriarLancamento = (itemBanco) => {
        const dataExtrato = normalizarData(itemBanco.data);
        const isCartao = contaSelecionada?.tipo === 'Cartão de Crédito';

        const novoLancamento = {
            conta_id: contaSelecionada?.id,
            descricao: itemBanco.descricao,
            valor: Math.abs(itemBanco.valor),
            tipo: (itemBanco.tipo === 'CREDIT' || itemBanco.valor > 0) ? 'Receita' : 'Despesa',
            data_transacao: dataExtrato, 
            data_vencimento: dataExtrato, 
            data_pagamento: isCartao ? null : dataExtrato,
            status: isCartao ? 'Pendente' : 'Conciliado', 
            conciliado: true,
            fitid: itemBanco.id, 
            auditoria_verificado: true
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
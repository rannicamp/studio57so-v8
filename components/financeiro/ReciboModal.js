// components/financeiro/ReciboModal.js
"use client";

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
import extenso from 'extenso';

const numeroParaExtenso = (valor) => {
    if (valor === null || valor === undefined || isNaN(valor)) return '';
    try {
        const valorStr = valor.toFixed(2).replace('.', ',');
        const extensoStr = extenso(valorStr, { mode: 'currency', currency: { type: 'BRL' } });
        return extensoStr.charAt(0).toUpperCase() + extensoStr.slice(1);
    } catch (e) {
        console.error("Erro ao converter número para extenso:", e);
        return "Valor inválido";
    }
};


export default function ReciboModal({ isOpen, onClose, lancamento: initialLancamento }) {
    const supabase = createClient();
    const { user, userData } = useAuth();
    const [lancamentoCompleto, setLancamentoCompleto] = useState(initialLancamento);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLancamentoCompleto = async () => {
            if (!initialLancamento?.id) return;

            setLoading(true);
            const { data, error } = await supabase
                .from('lancamentos')
                .select(`
                    *,
                    favorecido:contatos(nome, razao_social, cpf, cnpj),
                    conta:contas_financeiras(
                        nome,
                        empresa:cadastro_empresa(razao_social, cnpj, city)
                    )
                `)
                .eq('id', initialLancamento.id)
                .single();

            if (data) {
                setLancamentoCompleto(data);
            } else {
                setLancamentoCompleto(initialLancamento);
                console.error("Erro ao buscar dados completos do lançamento:", error);
            }
            setLoading(false);
        };

        if (isOpen) {
            fetchLancamentoCompleto();
        }
    }, [isOpen, initialLancamento, supabase]);

    const isReceita = lancamentoCompleto?.tipo === 'Receita';

    const pagador = isReceita ? lancamentoCompleto?.favorecido : lancamentoCompleto?.conta?.empresa;
    const recebedor = isReceita ? lancamentoCompleto?.conta?.empresa : lancamentoCompleto?.favorecido;

    const pagadorNome = isReceita ? (pagador?.nome || pagador?.razao_social) : pagador?.razao_social;
    const pagadorDocumento = isReceita ? (pagador?.cpf || pagador?.cnpj) : pagador?.cnpj;

    const valorPorExtenso = useMemo(() => numeroParaExtenso(lancamentoCompleto?.valor), [lancamentoCompleto]);

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    const ReceiptContent = ({ viaTitle, hideScreen }) => (
        <div className={`p-4 sm:p-8 font-sans ${hideScreen ? 'hidden print:block' : 'block print:hidden'} ${viaTitle ? 'print:pt-4 print:mt-4 print:border-t-[1px] print:border-dashed print:border-gray-400' : ''}`}>
            {viaTitle && (
                <div className="hidden print:block text-center font-bold text-gray-500 uppercase tracking-widest text-[10px] mb-2">{viaTitle}</div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-center mb-4 print:mb-2 print:text-lg">RECIBO</h1>

            <p className="text-base sm:text-lg leading-relaxed mb-4 print:mb-2 print:text-sm print:leading-snug">
                {isReceita ? "Recebemos de" : "Recebi(emos) de"} <strong>{pagadorNome || 'N/A'}</strong>,
                CPF/CNPJ nº <strong>{pagadorDocumento || 'N/A'}</strong>,
                a importância de <strong>R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(lancamentoCompleto?.valor || 0)}</strong>
                &nbsp;({valorPorExtenso}), referente a <strong>{lancamentoCompleto?.descricao}</strong>.
            </p>

            {lancamentoCompleto?.observacao && (
                <p className="text-sm sm:text-md italic bg-gray-50 p-2 sm:p-3 rounded-md print:bg-transparent print:border print:border-gray-200 print:text-[11px] print:p-1.5">
                    <strong>Observação:</strong> {lancamentoCompleto.observacao}
                </p>
            )}

            <p className="text-right mt-6 print:mt-2 print:text-xs">
                {recebedor?.city || 'N/A'}, {new Date(lancamentoCompleto?.data_pagamento || lancamentoCompleto?.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
            </p>

            <div className="assinatura text-center mt-12 sm:mt-20 print:mt-12">
                <div className="border-t border-black w-64 mx-auto print:w-48"></div>
                {isReceita ? (
                    <>
                        <p className="mt-1 text-xs print:text-[10px]">Representante: {userData?.nome} {userData?.sobrenome}</p>
                        <p className="font-semibold text-sm print:text-xs">{recebedor?.razao_social || 'N/A'}</p>
                        <p className="text-xs print:text-[10px]">CNPJ: {recebedor?.cnpj || 'N/A'}</p>
                    </>
                ) : (
                    <>
                        <p className="mt-1 font-semibold text-sm print:text-xs">{recebedor?.nome || recebedor?.razao_social || 'N/A'}</p>
                        <p className="text-xs print:text-[10px]">CPF/CNPJ: {recebedor?.cpf || recebedor?.cnpj || 'N/A'}</p>
                    </>
                )}
            </div>

            <div className="footer-info text-[10px] text-gray-500 mt-4 pt-2 border-t print:mt-2">
                <p>ID da Transação: {lancamentoCompleto?.id}</p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <style>{`
                @media print {
                    /* Impede a renderização das folhas fantasmas zerando a altura do documento base */
                    html, body {
                        height: 100vh !important;
                        overflow: hidden !important;
                    }
                    /* Força o recibo a ser a única coisa com altura na impressão, ajustando margens */
                    #recibo-imprimivel {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        background: white !important;
                        margin: 0 !important;
                        z-index: 99999 !important;
                    }
                }
            `}</style>
            
            <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-4 sm:p-6 border-b sticky top-0 bg-white rounded-t-lg z-10 print:hidden">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{isReceita ? 'Recibo de Recebimento' : 'Recibo de Pagamento'}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="text-gray-600 hover:text-blue-700 font-medium px-4 py-2 flex items-center gap-2 transition-colors"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                        <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                    </div>
                </div>
                <div className="p-0 sm:p-2 flex-grow overflow-y-auto">

                    {loading ? (
                        <div className="text-center p-12 print:hidden">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                            <p className="mt-2 text-gray-500">Montando documento...</p>
                        </div>
                    ) : (
                        <div id="recibo-imprimivel" className="recibo-container s57-print-area">
                            {/* VISÃO DE TELA: Apenas um recibo clássico normal */}
                            <ReceiptContent />
                            
                            {/* VISÃO DE IMPRESSÃO OTIMA: Duas vias na mesma folha (Cliente e Estabelecimento) */}
                            <div className="hidden print:block">
                                <ReceiptContent viaTitle="1ª Via (Cliente)" hideScreen={true} />
                                <ReceiptContent viaTitle="2ª Via (Estabelecimento)" hideScreen={true} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
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

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
                    <h3 className="text-2xl font-bold text-gray-800">{isReceita ? 'Recibo de Recebimento' : 'Recibo de Pagamento'}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="text-gray-600 hover:text-blue-700 font-medium px-4 py-2 flex items-center gap-2"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                        <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
                    </div>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">

                    {loading ? (
                        <div className="text-center p-12">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                            <p className="mt-2">Carregando dados do recibo...</p>
                        </div>
                    ) : (
                        <div id="recibo-imprimivel" className="recibo-container border rounded-md p-8 s57-print-area print:border-none print:shadow-none font-sans">
                            <h1 className="text-2xl font-bold text-center mb-6">RECIBO</h1>

                            <p className="text-lg leading-relaxed mb-6 print:leading-loose">
                                {isReceita ? "Recebemos de" : "Recebi(emos) de"} <strong>{pagadorNome || 'N/A'}</strong>,
                                CPF/CNPJ nº <strong>{pagadorDocumento || 'N/A'}</strong>,
                                a importância de <strong>R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(lancamentoCompleto?.valor || 0)}</strong>
                                ({valorPorExtenso}), referente a <strong>{lancamentoCompleto?.descricao}</strong>.
                            </p>

                            {lancamentoCompleto?.observacao && (
                                <p className="text-md italic bg-gray-50 p-3 rounded-md">
                                    <strong>Observação:</strong> {lancamentoCompleto.observacao}
                                </p>
                            )}

                            <p className="text-right mt-8">
                                {recebedor?.city || 'N/A'}, {new Date(lancamentoCompleto?.data_pagamento || lancamentoCompleto?.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
                            </p>

                            {/* ================================================================================= */}
                            {/* INÍCIO DA ATUALIZAÇÃO */}
                            {/* O PORQUÊ: Ajustamos a estrutura da assinatura para o formato solicitado,
                        priorizando clareza e profissionalismo quando a empresa recebe um pagamento. */}
                            {/* ================================================================================= */}
                            <div className="assinatura text-center mt-24 print:mt-40">
                                <div className="border-t border-black w-72 mx-auto"></div>
                                {isReceita ? (
                                    <>
                                        <p className="mt-2 text-sm">Representante: {userData?.nome} {userData?.sobrenome}</p>
                                        <p className="font-semibold">{recebedor?.razao_social || 'N/A'}</p>
                                        <p className="text-sm">CNPJ: {recebedor?.cnpj || 'N/A'}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="mt-2 font-semibold">{recebedor?.nome || recebedor?.razao_social || 'N/A'}</p>
                                        <p className="text-sm">CPF/CNPJ: {recebedor?.cpf || recebedor?.cnpj || 'N/A'}</p>
                                    </>
                                )}
                            </div>
                            {/* ================================================================================= */}
                            {/* FIM DA ATUALIZAÇÃO */}
                            {/* ================================================================================= */}

                            <div className="footer-info text-xs text-gray-500 mt-6 pt-4 border-t">
                                <p>ID da Transação: {lancamentoCompleto?.id}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
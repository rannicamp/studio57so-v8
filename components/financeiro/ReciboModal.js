// components/financeiro/ReciboModal.js
"use client";

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPrint, faSpinner } from '@fortawesome/free-solid-svg-icons';
// =================================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: Trocamos o 'require()' por 'import', que é a forma correta e moderna
// de usar bibliotecas em componentes React/Next.js. Isso também ajuda o sistema
// a encontrar o módulo que acabamos de instalar.
// =================================================================================
import extenso from 'extenso';
// =================================================================================
// FIM DA CORREÇÃO
// =================================================================================

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

    const valorPorExtenso = useMemo(() => numeroParaExtenso(lancamentoCompleto?.valor), [lancamentoCompleto]);
    const empresaPagadora = lancamentoCompleto?.conta?.empresa || lancamentoCompleto?.empresa;
    const favorecido = lancamentoCompleto?.favorecido;

    const handlePrint = () => {
        const printContents = document.getElementById('recibo-imprimivel').innerHTML;
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = `<style>body { font-family: sans-serif; } .recibo-container { width: 100%; max-width: 800px; margin: auto; padding: 20px; border: 1px solid #ccc; } h1 { text-align: center; } p { line-height: 1.6; } .assinatura { margin-top: 60px; text-align: center; } .footer-info { margin-top: 40px; font-size: 0.8em; color: #888; }</style>` + printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Recibo de Pagamento</h3>
                    <div>
                        <button onClick={handlePrint} className="text-gray-600 hover:text-blue-700 mr-4"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center p-12">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                        <p className="mt-2">Carregando dados do recibo...</p>
                    </div>
                ) : (
                    <div id="recibo-imprimivel" className="recibo-container border rounded-md p-8">
                        <h1 className="text-2xl font-bold text-center mb-6">RECIBO</h1>
                        
                        <p className="text-lg leading-relaxed mb-6">
                            Recebi(emos) de <strong>{empresaPagadora?.razao_social || 'N/A'}</strong>,
                            CNPJ nº <strong>{empresaPagadora?.cnpj || 'N/A'}</strong>,
                            a importância de <strong>R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(lancamentoCompleto?.valor || 0)}</strong>
                            ({valorPorExtenso}), referente a <strong>{lancamentoCompleto?.descricao}</strong>.
                        </p>
                        
                        {lancamentoCompleto?.observacao && (
                            <p className="text-md italic bg-gray-50 p-3 rounded-md">
                               <strong>Observação:</strong> {lancamentoCompleto.observacao}
                            </p>
                        )}

                        <p className="text-right mt-8">
                            {empresaPagadora?.city || 'N/A'}, {new Date(lancamentoCompleto?.data_pagamento || lancamentoCompleto?.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
                        </p>

                        <div className="assinatura">
                            <div className="border-t border-black w-72 mx-auto"></div>
                            <p className="mt-2 font-semibold">{favorecido?.nome || favorecido?.razao_social || 'N/A'}</p>
                            <p className="text-sm">CPF/CNPJ: {favorecido?.cpf || favorecido?.cnpj || 'N/A'}</p>
                        </div>

                        <div className="footer-info text-xs text-gray-500 mt-6 pt-4 border-t">
                            <p>ID da Transação: {lancamentoCompleto?.id}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
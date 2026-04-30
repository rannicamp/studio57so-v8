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

 const valorAbsoluto = Math.abs(lancamentoCompleto?.valor || 0);
 const valorPorExtenso = useMemo(() => numeroParaExtenso(valorAbsoluto), [valorAbsoluto]);

 const handlePrint = () => {
 const printContent = document.getElementById('recibo-imprimivel');
 if (!printContent) {
 window.print();
 return;
 }

 // Criamos um iframe invisível. Isso isola o recibo do resto da página,
 // garantindo que as 7 folhas fantasmas da tabela de fundo NÃO sejam impressas!
 const iframe = document.createElement('iframe');
 iframe.style.position = 'absolute';
 iframe.style.width = '0px';
 iframe.style.height = '0px';
 iframe.style.border = 'none';
 document.body.appendChild(iframe);

 // Copiamos os estilos (Tailwind) do projeto para dentro do iframe
 const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
 .map(node => node.outerHTML)
 .join('\n');

 const doc = iframe.contentWindow?.document;
 if (doc) {
 doc.open();
 doc.write(`
 <html>
 <head>
 <title>Recibo</title>
 ${styleLinks}
 <style>
 @page { size: auto; margin: 15mm; }
 body { margin: 0; background: white !important; -webkit-print-color-adjust: exact; }
 /* Sobrescrevemos o comportamento do globals.css para evitar que a s57-print-area quebre no iframe */
 .s57-print-area { position: relative !important; top: auto !important; left: auto !important; width: 100% !important; margin: 0 auto !important; box-shadow: none !important; }
 </style>
 </head>
 <body>
 ${printContent.outerHTML}
 </body>
 </html>
 `);
 doc.close();

 // Damos 250ms pro navegador aplicar os estilos antes de abrir o diálogo
 setTimeout(() => {
 iframe.contentWindow?.focus();
 iframe.contentWindow?.print();
 // Removemos o iframe da memória depois de um tempo
 setTimeout(() => document.body.removeChild(iframe), 2000);
 }, 250);
 } else {
 // Fallback se o navegador bloquear o iframe
 window.print();
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
 <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
 <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10 print:hidden">
 <h3 className="text-2xl font-bold text-gray-800">{isReceita ? 'Recibo de Recebimento' : 'Recibo de Pagamento'}</h3>
 <div className="flex items-center gap-2">
 <button onClick={handlePrint} className="text-gray-600 hover:text-blue-700 font-medium px-4 py-2 flex items-center gap-2 transition-colors"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
 <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
 </div>
 </div>
 <div className="p-6 flex-grow overflow-y-auto">

 {loading ? (
 <div className="text-center p-12 print:hidden">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
 <p className="mt-2 text-gray-500">Documento...</p>
 </div>
 ) : (
 <div id="recibo-imprimivel" className="recibo-container border rounded-md p-8 s57-print-area print:border-none print:shadow-none print:p-0 font-sans">
 <h1 className="text-2xl font-bold text-center mb-6 print:mb-4 print:text-xl">RECIBO</h1>

 <p className="text-lg leading-relaxed mb-6 print:leading-snug print:text-base print:mb-4 text-justify">
 {isReceita ? "Recebemos de" : "Recebi(emos) de"} <strong>{pagadorNome || 'N/A'}</strong>,
 CPF/CNPJ nº <strong>{pagadorDocumento || 'N/A'}</strong>,
 a importância de <strong>R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(valorAbsoluto)}</strong>
 &nbsp;({valorPorExtenso}), referente a <strong>{lancamentoCompleto?.descricao}</strong>.
 </p>

 {lancamentoCompleto?.observacao && (
 <p className="text-md italic bg-gray-50 p-3 rounded-md print:bg-transparent print:border print:border-gray-200 print:text-sm print:p-2">
 <strong>Observação:</strong> {lancamentoCompleto.observacao}
 </p>
 )}

 <p className="text-right mt-8 print:mt-6 print:text-sm">
 {recebedor?.city || 'N/A'}, {new Date(lancamentoCompleto?.data_pagamento || lancamentoCompleto?.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
 </p>

 <div className="assinatura text-center mt-24 print:mt-16">
 <div className="border-t border-black w-72 mx-auto print:w-64"></div>
 {isReceita ? (
 <>
 <p className="mt-2 text-sm print:text-xs">Representante: {userData?.nome} {userData?.sobrenome}</p>
 <p className="font-semibold print:text-sm">{recebedor?.razao_social || 'N/A'}</p>
 <p className="text-sm print:text-xs">CNPJ: {recebedor?.cnpj || 'N/A'}</p>
 </>
 ) : (
 <>
 <p className="mt-2 font-semibold print:text-sm">{recebedor?.nome || recebedor?.razao_social || 'N/A'}</p>
 <p className="text-sm print:text-xs">CPF/CNPJ: {recebedor?.cpf || recebedor?.cnpj || 'N/A'}</p>
 </>
 )}
 </div>

 <div className="footer-info text-xs text-gray-500 mt-6 pt-4 border-t print:mt-4 print:pt-2">
 <p>ID da Transação: {lancamentoCompleto?.id}</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
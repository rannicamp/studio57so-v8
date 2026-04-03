//components/financeiro/AntecipacaoModal.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faSpinner, faMoneyBillTransfer, faBuildingColumns,
 faTimes, faCalendarAlt, faReceipt, faInfoCircle,
 faArrowRight, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function AntecipacaoModal({ isOpen, onClose, onSave, lancamentoOrigem, contas }) {
 const [formData, setFormData] = useState({
 conta_passivo_id: '',
 conta_destino_id: '',
 data_transacao: new Date().toISOString().split('T')[0],
 valor_bruto: '',
 valor_taxas: '0',
 });

 const [loading, setLoading] = useState(false);

 // Empresa do lançamento (olha na conta caso não esteja diretamente)
 const empresaAlvoId = lancamentoOrigem?.empresa_id || lancamentoOrigem?.conta?.empresa_id;

 // Filtro INTELIGENTE: se soubermos a empresa do boleto, só mostra contas dessa empresa.
 // Se não souber a empresa, mostra todas para não bloquear o usuário.
 const filtroPorEmpresa = (c) => !empresaAlvoId || c.empresa_id === empresaAlvoId;

 // ✅ BUG CORRIGIDO: tipo correto no banco é 'Conta de Passivo' (não 'Passivos')
 const contasPassivo = contas?.filter(c =>
 c.tipo === 'Conta de Passivo' && filtroPorEmpresa(c)
 ) || [];

 // ✅ BUG CORRIGIDO: tipo correto no banco é 'Conta de Ativo' (não 'Ativos')
 const contasDestino = contas?.filter(c =>
 c.tipo !== 'Conta de Passivo' && c.tipo !== 'Conta de Ativo' && filtroPorEmpresa(c)
 ) || [];

 useEffect(() => {
 if (isOpen && lancamentoOrigem) {
 const valorFormatado = Number(lancamentoOrigem.valor || 0).toLocaleString('pt-BR', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2
 });
 setFormData(prev => ({
 ...prev,
 valor_bruto: valorFormatado,
 conta_passivo_id: contasPassivo[0]?.id || '',
 conta_destino_id: contasDestino[0]?.id || ''
 }));
 }
 }, [isOpen, lancamentoOrigem]);

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleMaskedChange = (name, value) => {
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const parseCurrency = (val) => {
 if (!val) return 0;
 const strVal = String(val);
 if (strVal.includes(',')) {
 return Number(strVal.replace(/\./g, '').replace(',', '.')) || 0;
 }
 return Number(strVal) || 0;
 };

 const valorBrutoNum = parseCurrency(formData.valor_bruto);
 const valorTaxasNum = parseCurrency(formData.valor_taxas);
 const valorLiquido = Number((valorBrutoNum - valorTaxasNum).toFixed(2));

 const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);

 const antecipacaoGrupoId = crypto.randomUUID();
 const payload = {
 lancamentoOrigemId: lancamentoOrigem.id,
 descricaoOrigem: lancamentoOrigem.descricao,
 contaPassivoId: formData.conta_passivo_id,
 contaDestinoId: formData.conta_destino_id,
 dataTransacao: formData.data_transacao,
 valorBruto: valorBrutoNum,
 valorTaxas: valorTaxasNum,
 antecipacaoGrupoId,
 empresaId: empresaAlvoId,
 organizacaoId: lancamentoOrigem.organizacao_id
 };

 const success = await onSave(payload);
 setLoading(false);
 if (success) onClose();
 };

 if (!isOpen || !lancamentoOrigem) return null;

 const labelCls = "block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5";
 const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm";
 const selectCls = "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm appearance-none";

 return (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-gray-50 rounded-2xl shadow-sm w-full max-w-xl max-h-[95vh] flex flex-col border border-gray-200 overflow-hidden">

 {/* ── HEADER ── */}
 <div className="flex justify-between items-center px-6 py-5 bg-white border-b border-gray-200">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
 <FontAwesomeIcon icon={faMoneyBillTransfer} />
 </div>
 <div>
 <h3 className="text-lg font-bold text-gray-800">Antecipar Recebível</h3>
 <p className="text-xs text-gray-500 font-medium">Registrar operação de antecipação junto ao banco</p>
 </div>
 </div>
 <button
 onClick={onClose}
 type="button"
 className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
 >
 <FontAwesomeIcon icon={faTimes} />
 </button>
 </div>

 {/* ── BOLETO ORIGEM (INFO) ── */}
 <div className="px-6 pt-5">
 <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Boleto sendo antecipado</p>
 <p className="text-sm font-bold text-gray-800 leading-tight truncate">{lancamentoOrigem.descricao || '—'}</p>
 <p className="text-xs text-gray-500 font-medium mt-0.5">
 Valor: <span className="font-bold text-gray-700">
 {Number(lancamentoOrigem.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
 </span>
 </p>
 </div>
 </div>

 {/* ── FORM ── */}
 <div className="p-6 flex-grow overflow-y-auto space-y-5">
 <form onSubmit={handleSubmit} className="space-y-5" id="form-antecipacao">

 {/* Seção: Contas */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-red-500 hidden"></div>
 <div className="px-5 py-4 border-b border-gray-100">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Contas da Operação</p>
 </div>
 <div className="p-5 space-y-4">

 {/* Conta Passivo */}
 <div>
 <label className={labelCls}>
 <FontAwesomeIcon icon={faBuildingColumns} className="mr-1.5 text-red-400" />
 Conta de Passivo (Dívida)
 </label>
 <div className="relative">
 <select
 name="conta_passivo_id"
 value={formData.conta_passivo_id}
 onChange={handleChange}
 required
 className={selectCls}
 >
 <option value="">Selecione a conta de passivo...</option>
 {contasPassivo.map(c => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 </select>
 </div>
 {contasPassivo.length === 0 && (
 <p className="text-[11px] font-semibold text-red-500 mt-1.5">
 ⚠️ Nenhuma conta do tipo "Conta de Passivo" encontrada para esta empresa.
 </p>
 )}
 </div>

 {/* Seta visual */}
 <div className="flex items-center justify-center text-gray-300">
 <FontAwesomeIcon icon={faArrowRight} />
 </div>

 {/* Conta Destino */}
 <div>
 <label className={labelCls}>
 <FontAwesomeIcon icon={faBuildingColumns} className="mr-1.5 text-green-500" />
 Conta Destino (Onde o dinheiro entra)
 </label>
 <div className="relative">
 <select
 name="conta_destino_id"
 value={formData.conta_destino_id}
 onChange={handleChange}
 required
 className={selectCls}
 >
 <option value="">Selecione a conta de destino...</option>
 {contasDestino.map(c => (
 <option key={c.id} value={c.id}>{c.nome}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 </div>

 {/* Seção: Valores */}
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
 <div className="px-5 py-4 border-b border-gray-100">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Valores da Operação</p>
 </div>
 <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

 {/* Data */}
 <div>
 <label className={labelCls}>
 <FontAwesomeIcon icon={faCalendarAlt} className="mr-1.5 text-gray-400" />
 Data da Antecipação
 </label>
 <input
 type="date"
 name="data_transacao"
 value={formData.data_transacao}
 onChange={handleChange}
 required
 className={inputCls}
 />
 </div>

 {/* Valor Original */}
 <div>
 <label className={labelCls}>
 <FontAwesomeIcon icon={faReceipt} className="mr-1.5 text-gray-400" />
 Valor Original do Boleto
 </label>
 <input
 type="text"
 value={`R$ ${formData.valor_bruto}`}
 readOnly
 className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed shadow-sm"
 />
 </div>

 {/* Taxas */}
 <div>
 <label className={labelCls + " text-red-500"}>
 Taxas e Juros do Banco
 </label>
 <IMaskInput
 mask="num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' } }}
 name="valor_taxas"
 value={String(formData.valor_taxas)}
 onAccept={(value) => handleMaskedChange('valor_taxas', value)}
 required
 className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm font-bold text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all shadow-sm"
 />
 </div>

 {/* Valor Líquido */}
 <div>
 <label className={labelCls + " text-green-600"}>
 Valor Líquido (Entrada Caixa)
 </label>
 <div className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-bold text-green-700 shadow-sm flex items-center gap-2">
 <FontAwesomeIcon icon={faCheckCircle} className="text-green-400 text-xs" />
 {valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
 </div>
 </div>
 </div>
 </div>

 {/* Info Box */}
 <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
 <FontAwesomeIcon icon={faInfoCircle} className="text-blue-400 mt-0.5 flex-shrink-0" />
 <div className="text-xs text-blue-700 space-y-1">
 <p className="font-bold">O que vai acontecer:</p>
 <ul className="list-disc ml-4 space-y-0.5 font-medium">
 <li>O boleto original será movido para a <strong>Conta de Passivo</strong>.</li>
 <li>Uma receita de <strong>{valorBrutoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> entrará na Conta Destino.</li>
 <li>Uma despesa de taxas de <strong>{valorTaxasNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> será registrada.</li>
 </ul>
 </div>
 </div>

 </form>
 </div>

 {/* ── FOOTER ── */}
 <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-gray-200">
 <button
 type="button"
 onClick={onClose}
 className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
 >
 <FontAwesomeIcon icon={faTimes} className="text-gray-400" /> Cancelar
 </button>
 <button
 type="submit"
 form="form-antecipacao"
 disabled={loading || contasPassivo.length === 0 || contasDestino.length === 0}
 className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-extrabold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
 >
 {loading
 ? <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</>
 : <><FontAwesomeIcon icon={faMoneyBillTransfer} /> Efetivar Antecipação</>
 }
 </button>
 </div>
 </div>
 </div>
 );
}
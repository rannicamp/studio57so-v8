//components/financeiro/ContaFormModal.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faTrash, faTimes, faLink } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function ContaFormModal({ isOpen, onClose, onSave, initialData, empresas, contas }) {
 const isEditing = Boolean(initialData);

 const getInitialState = () => ({
 nome: '',
 tipo: 'Conta Corrente',
 saldo_inicial: '',
 instituicao: '',
 codigo_banco_ofx: '',
 empresa_id: null,
 agencia: '',
 numero_conta: '',
 chaves_pix: [{ tipo: 'CNPJ', chave: '' }],
 limite_cheque_especial: '',
 limite_credito: '',
 dia_fechamento_fatura: '',
 dia_pagamento_fatura: '',
 conta_debito_fatura_id: null,
 conta_pai_id: null,
 });

 const [formData, setFormData] = useState(getInitialState());
 const [loading, setLoading] = useState(false);
 const [bancosList, setBancosList] = useState([]);
 const [instituicaoQuery, setInstituicaoQuery] = useState('');
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);
 const dropdownRef = useRef(null);

 // Mapear Bancos da Brasil API
 useEffect(() => {
 if (isOpen && bancosList.length === 0) {
 fetch('https://brasilapi.com.br/api/bancos/v1')
 .then(res => res.json())
 .then(data => {
 // Filtrar apenas bancos com código válido
 const validBanks = data.filter(b => b.code != null && b.name);
 setBancosList(validBanks);
 })
 .catch(err => console.error("Erro ao carregar bancos da Brasil API:", err));
 }
 }, [isOpen, bancosList.length]);

 // Fechar dropdown ao clicar fora
 useEffect(() => {
 const handleClickOutside = (event) => {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
 setIsDropdownOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 useEffect(() => {
 if (isOpen) {
 const initial = isEditing ? { ...getInitialState(), ...initialData } : getInitialState();
 if (!initial.chaves_pix || !Array.isArray(initial.chaves_pix) || initial.chaves_pix.length === 0) {
 initial.chaves_pix = [{ tipo: 'CNPJ', chave: '' }];
 }
 setFormData(initial);
 setInstituicaoQuery(initial.instituicao || '');
 }
 }, [isOpen, initialData, isEditing]);

 const handleSelectBank = (bank) => {
 const codigoFormatado = String(bank.code).padStart(3, '0');
 const nomeInstituicao = bank.name;

 setInstituicaoQuery(nomeInstituicao);
 setFormData(prev => ({
 ...prev,
 instituicao: nomeInstituicao,
 codigo_banco_ofx: codigoFormatado,
 nome: prev.nome ? prev.nome : `${codigoFormatado} - ${nomeInstituicao}` // Preenche automaticamente o nome se estiver vazio
 }));
 setIsDropdownOpen(false);
 };

 const filteredBancos = bancosList.filter(b =>
 (b.name && b.name.toLowerCase().includes(instituicaoQuery.toLowerCase())) ||
 (b.code && String(b.code).includes(instituicaoQuery))
 );

 // Herdar propriedades do cartão principal automaticamente
 useEffect(() => {
 if (formData.tipo === 'Cartão de Crédito' && formData.conta_pai_id) {
 const parent = contas?.find(c => String(c.id) === String(formData.conta_pai_id));
 if (parent) {
 setFormData(prev => {
 const nextState = { ...prev };
 let changed = false;
 if (nextState.empresa_id !== parent.empresa_id) { nextState.empresa_id = parent.empresa_id; changed = true; }
 if (nextState.dia_fechamento_fatura != parent.dia_fechamento_fatura) { nextState.dia_fechamento_fatura = parent.dia_fechamento_fatura; changed = true; }
 if (nextState.dia_pagamento_fatura != parent.dia_pagamento_fatura) { nextState.dia_pagamento_fatura = parent.dia_pagamento_fatura; changed = true; }
 if (nextState.conta_debito_fatura_id !== parent.conta_debito_fatura_id) { nextState.conta_debito_fatura_id = parent.conta_debito_fatura_id; changed = true; }
 if (nextState.limite_credito != 0) { nextState.limite_credito = 0; changed = true; }
 return changed ? nextState : prev;
 });
 }
 }
 }, [formData.conta_pai_id, formData.tipo, contas]);

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
 };

 const handleMaskedChange = (name, value) => {
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handlePixChange = (index, field, value) => {
 const newChaves = [...formData.chaves_pix];
 newChaves[index][field] = value;
 setFormData(prev => ({ ...prev, chaves_pix: newChaves }));
 };

 const addPixField = () => {
 setFormData(prev => ({ ...prev, chaves_pix: [...prev.chaves_pix, { tipo: 'E-mail', chave: '' }] }));
 };

 const removePixField = (index) => {
 setFormData(prev => ({ ...prev, chaves_pix: prev.chaves_pix.filter((_, i) => i !== index) }));
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);
 const dataToSave = {
 ...formData,
 chaves_pix: formData.chaves_pix.filter(p => p.chave && p.chave.trim() !== '')
 };
 const success = await onSave(dataToSave);
 setLoading(false);
 if (success) {
 onClose();
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
 <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg z-10">
 <h3 className="text-2xl font-bold text-gray-800">{isEditing ? 'Editar Conta' : 'Adicionar Nova Conta'}</h3>
 <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
 </div>
 <div className="p-6 flex-grow overflow-y-auto">
 <form onSubmit={handleSubmit} className="space-y-4">
 {/* --- DADOS GERAIS --- */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium">Nome da Conta/Bem *</label>
 <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Conta Itaú, Lote Y, Antecipação Safra" />
 </div>
 <div>
 <label className="block text-sm font-medium">Empresa Proprietária</label>
 <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} disabled={!!formData.conta_pai_id} className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100 disabled:text-gray-500">
 <option value="">Nenhuma</option>
 {empresas.map(emp => (
 <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium">Tipo de Conta</label>
 <select name="tipo" value={formData.tipo} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
 <option value="Conta Corrente">Conta Corrente</option>
 <option value="Cartão de Crédito">Cartão de Crédito</option>
 <option value="Conta Investimento">Conta Investimento</option>
 <option value="Dinheiro">Dinheiro Físico</option>
 <optgroup label="── Patrimonial ──">
 <option value="Conta de Ativo">🏛️ Conta de Ativo (Bens/Imóveis/Equipamentos)</option>
 <option value="Conta de Passivo">📉 Conta de Passivo (Empréstimos/Dívidas)</option>
 </optgroup>
 </select>
 </div>
 <div>
 {/* Mudança dinâmica do label baseada no tipo de conta */}
 <label className="block text-sm font-medium">
 {formData.tipo === 'Conta de Passivo' ? 'Saldo Devedor Atual *' : formData.tipo === 'Conta de Ativo' ? 'Valor do Bem *' : 'Saldo Inicial / Fatura Aberta *'}
 </label>
 <IMaskInput
 mask="R$ num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', signed: true } }}
 name="saldo_inicial"
 value={String(formData.saldo_inicial || '')}
 onAccept={(value) => handleMaskedChange('saldo_inicial', value)}
 required
 className="mt-1 w-full p-2 border rounded-md"
 />
 </div>
 <div className="relative" ref={dropdownRef}>
 <label className="block text-sm font-medium text-gray-700">Instituição Financeira / Banco</label>
 <input
 type="text"
 value={instituicaoQuery}
 onChange={(e) => {
 setInstituicaoQuery(e.target.value);
 setIsDropdownOpen(true);
 setFormData(prev => ({ ...prev, instituicao: e.target.value }));
 }}
 onFocus={() => setIsDropdownOpen(true)}
 className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
 placeholder="Pesquise o banco (Ex: Itaú, 001)..."
 />
 {isDropdownOpen && (
 <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto divide-y divide-gray-100">
 {filteredBancos.length > 0 ? (
 filteredBancos.map(bank => (
 <li
 key={bank.code}
 onClick={() => handleSelectBank(bank)}
 className="p-3 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-3"
 >
 <span className="font-semibold text-blue-700 bg-blue-100/50 px-2 py-1 rounded-md text-xs">{String(bank.code).padStart(3, '0')}</span>
 <span className="text-gray-700 font-medium">{bank.name}</span>
 </li>
 ))
 ) : (
 <li className="p-4 text-center text-gray-500 text-sm">Nenhum banco encontrado... Você pode digitar livremente.</li>
 )}
 </ul>
 )}
 </div>
 </div>

 {/* --- SEÇÃO PARA CONTA CORRENTE --- */}
 {formData.tipo === 'Conta Corrente' && (
 <div className="pt-4 border-t border-gray-200 space-y-4">
 <h4 className="font-bold text-gray-800">Detalhes da Conta Corrente</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium">Agência</label>
 <input type="text" name="agencia" value={formData.agencia || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
 </div>
 <div>
 <label className="block text-sm font-medium">Número da Conta</label>
 <input type="text" name="numero_conta" value={formData.numero_conta || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium">Limite do Cheque Especial</label>
 <IMaskInput
 mask="R$ num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' } }}
 name="limite_cheque_especial"
 value={String(formData.limite_cheque_especial || '')}
 onAccept={(value) => handleMaskedChange('limite_cheque_especial', value)}
 className="mt-1 w-full p-2 border rounded-md"
 />
 </div>
 <div>
 <label className="block text-sm font-medium mb-2">Chaves PIX</label>
 <div className="space-y-2">
 {formData.chaves_pix.map((pix, index) => (
 <div key={index} className="flex items-center gap-2">
 <select value={pix.tipo} onChange={(e) => handlePixChange(index, 'tipo', e.target.value)} className="p-2 border rounded-md w-1/3">
 <option>CNPJ</option><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option>
 </select>
 <input type="text" value={pix.chave} onChange={(e) => handlePixChange(index, 'chave', e.target.value)} placeholder="Insira a chave" className="p-2 border rounded-md flex-grow" />
 <button type="button" onClick={() => removePixField(index)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
 </div>
 ))}
 </div>
 <button type="button" onClick={addPixField} className="text-blue-600 hover:text-blue-800 text-sm font-semibold mt-2 flex items-center gap-1">
 <FontAwesomeIcon icon={faPlus} /> Adicionar Chave PIX
 </button>
 </div>
 </div>
 )}

 {/* --- SEÇÃO PARA CARTÃO DE CRÉDITO --- */}
 {formData.tipo === 'Cartão de Crédito' && (
 <div className="pt-4 border-t border-gray-200 space-y-4">
 <h4 className="font-bold text-gray-800">Detalhes do Cartão de Crédito</h4>
 <div>
 <label className="block text-sm font-medium">Cartão Principal (Opcional)</label>
 <select
 name="conta_pai_id"
 value={formData.conta_pai_id || ''}
 onChange={handleChange}
 className="mt-1 w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none transition-all"
 >
 <option value="">Nenhum (Cartão Titular)</option>
 {contas?.filter(c => c.tipo === 'Cartão de Crédito' && c.id !== formData.id && !c.conta_pai_id).map(conta => (
 <option key={conta.id} value={conta.id}>{conta.nome}</option>
 ))}
 </select>
 <p className="text-[10px] text-gray-500 mt-1">Selecione apenas se este for um cartão virtual/adicional.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium">Limite de Crédito</label>
 {formData.conta_pai_id ? (
 <div className="mt-1 w-full p-2 border rounded-md bg-gray-100 text-gray-500 flex items-center gap-2 text-sm font-semibold h-10">
 <FontAwesomeIcon icon={faLink} /> Compartilhado com o Pai
 </div>
 ) : (
 <IMaskInput
 mask="R$ num"
 blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' } }}
 name="limite_credito"
 value={String(formData.limite_credito || '')}
 onAccept={(value) => handleMaskedChange('limite_credito', value)}
 className="mt-1 w-full p-2 border rounded-md"
 />
 )}
 </div>
 <div>
 <label className="block text-sm font-medium">Dia Fechamento Fatura</label>
 <input type="number" name="dia_fechamento_fatura" value={formData.dia_fechamento_fatura || ''} onChange={handleChange} disabled={!!formData.conta_pai_id} min="1" max="31" className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100 disabled:text-gray-500" />
 </div>
 <div>
 <label className="block text-sm font-medium">Dia Pagamento Fatura</label>
 <input type="number" name="dia_pagamento_fatura" value={formData.dia_pagamento_fatura || ''} onChange={handleChange} disabled={!!formData.conta_pai_id} min="1" max="31" className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100 disabled:text-gray-500" />
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium">Conta para Débito da Fatura</label>
 <select name="conta_debito_fatura_id" value={formData.conta_debito_fatura_id || ''} onChange={handleChange} disabled={!!formData.conta_pai_id} className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100 disabled:text-gray-500">
 <option value="">Nenhuma / Pagamento Manual</option>
 {contas?.filter(c => c.tipo !== 'Cartão de Crédito' && c.tipo !== 'Conta de Ativo' && c.tipo !== 'Conta de Passivo').map(conta => (
 <option key={conta.id} value={conta.id}>{conta.nome}</option>
 ))}
 </select>
 </div>
 </div>
 )}

 <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-100">
 <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Cancelar</button>
 <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
 {loading ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : 'Salvar Conta'}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}
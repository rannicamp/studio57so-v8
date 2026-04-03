//components\contratos\CronogramaFinanceiro.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle, faEdit, faTimes, faCopy, faExchangeAlt, faLink, faPrint } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import PlanoPagamentoPrint from './PlanoPagamentoPrint';
import { useAuth } from '../../contexts/AuthContext';

// --- FUNÇÕES DE FORMATAÇÃO E ESTILO (Inalteradas) ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0] : '';

const formatDateForDisplay = (dateStr) => {
 if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
 const [year, month, day] = dateStr.split('-');
 return `${day}/${month}/${year}`;
};

const getParcelaStatus = (parcela) => {
 if (parcela.status_pagamento === 'Pago') {
 return { text: 'Paga', className: 'bg-green-100 text-green-800' };
 }
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const dueDate = new Date(parcela.data_vencimento + 'T00:00:00Z');

 if (dueDate < today) {
 return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
 }
 return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
};

export default function CronogramaFinanceiro({ contrato, onUpdate }) {
 const { id: contratoId, contrato_parcelas: parcelas, contrato_permutas: permutas, valor_final_venda: valorTotalContrato } = contrato;

 const supabase = createClient();
 const { user, userData } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const [localParcelas, setLocalParcelas] = useState(parcelas || []);
 const [localPermutas, setLocalPermutas] = useState(permutas || []);
 const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
 const [editingParcelaId, setEditingParcelaId] = useState(null);
 const [editingParcelaData, setEditingParcelaData] = useState({});
 const [newPermuta, setNewPermuta] = useState({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] });
 const [loading, setLoading] = useState(false);
 const [isProvisioning, setIsProvisioning] = useState(false);
 const [proprietarios, setProprietarios] = useState([]);
 const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
 const [geradoPor, setGeradoPor] = useState('');
 const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';

 useEffect(() => {
 const fetchInitialData = async () => {
 if (!organizacaoId) return;
 const { data: proprietariosData } = await supabase.from('usuarios').select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)').eq('organizacao_id', organizacaoId).eq('funcoes.nome_funcao', 'Proprietário');
 setProprietarios(proprietariosData || []);
 if (isUserProprietario && user) setSelectedSignatoryId(user.id);
 else if (proprietariosData?.length > 0) setSelectedSignatoryId(proprietariosData[0].id);
 if (userData) setGeradoPor(`${userData.nome} ${userData.sobrenome}`);
 };
 fetchInitialData();
 }, [supabase, user, userData, isUserProprietario, organizacaoId]);

 const selectedSignatory = useMemo(() => {
 if (!selectedSignatoryId || proprietarios.length === 0) return null;
 const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
 return signatory ? { name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(), cpf: signatory.funcionario?.cpf || 'N/A' } : null;
 }, [selectedSignatoryId, proprietarios]);

 useEffect(() => { setLocalParcelas(parcelas || []); setLocalPermutas(permutas || []); }, [parcelas, permutas]);

 // =================================================================================
 // LÓGICA "INTELIGENTE" (Inalterada)
 // =================================================================================
 const {
 parcelasNormais,
 parcelasOrdenadas,
 totalParcelasNormais, // Soma de Entrada, Obra, Adicionais, etc.
 totalPermutas,
 displaySaldoRemanescente, // O objeto Saldo Remanescente com valor CALCULADO
 diferencaDeSincronia // O alerta que mostra se o valor do banco está desatualizado
 } = useMemo(() => {
 const pNormais = (localParcelas || []).filter(p =>
 p.tipo !== 'Saldo Remanescente' &&
 !p.descricao?.toLowerCase().includes('saldo remanescente')
 );

 const pSaldoOriginal = (localParcelas || []).find(p =>
 p.tipo === 'Saldo Remanescente' ||
 p.descricao?.toLowerCase().includes('saldo remanescente')
 );

 const pOrdenadas = [...pNormais].sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

 const tParcelasNormais = pNormais.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
 const tPermutas = (localPermutas || []).reduce((sum, p) => sum + parseFloat(p.valor_permutado || 0), 0);

 // MÁGICA: O valor "inteligente" do saldo remanescente é calculado
 const valorCalculadoSaldo = parseFloat(valorTotalContrato || 0) - tParcelasNormais - tPermutas;

 let dSaldo = {
 id: pSaldoOriginal?.id || 'calculado',
 descricao: pSaldoOriginal?.descricao || 'Saldo Remanescente (Chaves)',
 data_vencimento: pSaldoOriginal?.data_vencimento || '', // Preserva a data
 tipo: pSaldoOriginal?.tipo || 'Saldo Remanescente',
 valor_parcela: valorCalculadoSaldo // Sobrescreve o valor do banco!
 };

 // A "DIFERENÇA" (Verificação) agora é o quanto o valor calculado difere do valor salvo no banco.
 const valorOriginalSaldo = parseFloat(pSaldoOriginal?.valor_parcela || 0);
 const tDiferenca = valorCalculadoSaldo - valorOriginalSaldo;

 return {
 parcelasNormais: pNormais,
 parcelasOrdenadas: pOrdenadas,
 totalParcelasNormais: tParcelasNormais,
 totalPermutas: tPermutas,
 displaySaldoRemanescente: dSaldo,
 diferencaDeSincronia: tDiferenca // O alerta (diferença real do banco)
 };

 }, [localParcelas, localPermutas, valorTotalContrato]);
 // =================================================================================
 // FIM DA LÓGICA
 // =================================================================================

 const hasPendingParcelsToProvision = useMemo(() => localParcelas.some(p => !p.lancamento_id && p.status_pagamento === 'Pendente'), [localParcelas]);

 // --- LÓGICA DE PROVISIONAMENTO (Inalterada) ---
 const handleProvisionarLancamentos = async () => {
 setIsProvisioning(true);
 const promise = supabase.rpc('provisionar_parcelas_contrato', { p_contrato_id: contratoId, p_organizacao_id: organizacaoId });
 toast.promise(promise, {
 loading: 'Provisionando lançamentos...',
 success: (rpcResult) => {
 onUpdate();
 if (rpcResult.error) throw new Error(rpcResult.error.message);
 const responseMessage = rpcResult.data;
 if (typeof responseMessage !== 'string') { console.error("Resposta inesperada:", responseMessage); throw new Error("Erro inesperado."); }
 if (responseMessage.startsWith('Erro:')) throw new Error(responseMessage);
 if (responseMessage.startsWith('Nenhuma')) toast.info(responseMessage);
 return responseMessage;
 },
 error: (err) => `Falha: ${err.message.replace(/^Error:\s*/, '')}`,
 finally: () => setIsProvisioning(false)
 });
 };

 // --- LÓGICA DE PARCELAS (Inalterada) ---
 const handleAddParcela = async () => {
 if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) return toast.error("Preencha todos os campos.");
 if (!organizacaoId) return toast.error("Organização não identificada.");
 setLoading(true);
 const valorNumerico = parseFloat(newParcela.valor_parcela) || 0;
 const { data: insertedData, error: insertError } = await supabase.from('contrato_parcelas').insert({ contrato_id: contratoId, ...newParcela, valor_parcela: valorNumerico, organizacao_id: organizacaoId }).select().single();
 if (insertError) { toast.error("Erro: " + insertError.message); setLoading(false); return; }
 toast.success("Parcela adicionada!");
 const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: insertedData.id, p_organizacao_id: organizacaoId });
 if (syncError) toast.warning("Erro ao criar lançamento: " + syncError.message); else toast.success("Lançamento criado!");
 setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
 onUpdate(); setLoading(false);
 };

 const handleSaveEditingParcela = async (parcelaId) => {
 setLoading(true);
 const { id, ...updateData } = editingParcelaData;
 updateData.valor_parcela = parseFloat(String(updateData.valor_parcela || '')) || 0;
 const { error: updateError } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);
 if (updateError) { toast.error("Erro: " + updateError.message); setLoading(false); return; }
 toast.success("Parcela atualizada!");
 const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
 if (syncError) toast.warning("Erro ao sincronizar: " + syncError.message); else toast.success("Lançamento atualizado!");
 setEditingParcelaId(null); onUpdate(); setLoading(false);
 };

 const handleDeleteParcela = (parcelaId) => {
 toast("Confirmar Exclusão", {
 description: "O lançamento financeiro vinculado também será excluído.",
 action: {
 label: "Excluir", onClick: () => {
 setLoading(true);
 const promise = supabase.rpc('excluir_parcela_e_lancamento', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
 toast.promise(promise, { loading: 'Excluindo...', success: () => { onUpdate(); return "Parcela excluída."; }, error: (err) => `Erro: ${err.message}`, finally: () => setLoading(false) });
 }
 },
 cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }
 });
 };

 const handleDuplicateParcela = (parcelaId) => {
 toast("Confirmar Duplicação", {
 description: "Deseja criar uma cópia desta parcela?",
 action: {
 label: "Duplicar", onClick: () => {
 const promise = new Promise(async (resolve, reject) => {
 const { data, error } = await supabase.rpc('duplicar_parcela_contrato', { p_parcela_id: parcelaId, p_organizacao_id: organizacaoId });
 if (error) return reject(new Error(error.message));
 if (data && data.success) resolve(data.message); else reject(new Error(data.message || 'Erro.'));
 });
 toast.promise(promise, { loading: 'Duplicando...', success: (message) => { onUpdate(); return message; }, error: (err) => `Erro: ${err.message}` });
 }
 },
 cancel: { label: "Cancelar" }
 });
 };

 // --- LÓGICA DE PERMUTAS (Inalterada) ---
 const handleAddPermuta = async () => {
 if (!newPermuta.descricao || !newPermuta.valor_permutado || !newPermuta.data_registro) return toast.error("Preencha todos os campos da permuta.");
 if (!organizacaoId) return toast.error("Organização não identificada.");
 setLoading(true);
 const valorNumerico = parseFloat(newPermuta.valor_permutado) || 0;
 const { error } = await supabase.from('contrato_permutas').insert({ contrato_id: contratoId, ...newPermuta, valor_permutado: valorNumerico, organizacao_id: organizacaoId });
 if (error) { toast.error("Erro: " + error.message); }
 else { toast.success("Permuta adicionada!"); setNewPermuta({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] }); onUpdate(); }
 setLoading(false);
 };

 const handleDeletePermuta = (permutaId) => {
 toast("Confirmar Exclusão", {
 description: "Tem certeza que deseja excluir esta permuta?",
 action: {
 label: "Excluir", onClick: () => {
 setLoading(true);
 const promise = supabase.from('contrato_permutas').delete().eq('id', permutaId);
 toast.promise(promise, { loading: 'Excluindo...', success: () => { onUpdate(); return "Permuta excluída."; }, error: (err) => `Erro: ${err.message}`, finally: () => setLoading(false) });
 }
 },
 cancel: { label: "Cancelar" }, classNames: { actionButton: 'bg-red-600' }
 });
 };

 // --- LÓGICA DE EDIÇÃO (Inalterada) ---
 const handleStartEditingParcela = (parcela) => { setEditingParcelaId(parcela.id); setEditingParcelaData(parcela); };
 const handleCancelEditingParcela = () => { setEditingParcelaId(null); setEditingParcelaData({}); };
 const handleEditingParcelaChange = (field, value) => setEditingParcelaData(prev => ({ ...prev, [field]: value }));

 return (
 <div>
 {/* --- BLOCO DE ESTILOS (Inalterado) --- */}
 <style jsx global>{`
 @media print { [data-sonner-toast] { visibility: hidden !important; display: none !important; }
 .printable-area { padding-left: 1.5cm; box-sizing: border-box; } } `}</style>

 {/* --- ÁREA DE IMPRESSÃO (Inalterada) --- */}
 <div className="hidden print:block printable-area s57-print-area">
 <PlanoPagamentoPrint contrato={contrato} signatory={selectedSignatory} geradoPor={geradoPor} />
 </div>

 <div className="print:hidden bg-white p-6 rounded-lg border border-gray-200 flex-shrink-0 space-y-8 animate-fade-in shadow-sm">
 <div className="space-y-4">
 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">Permutas Registradas</h3>
 <div className="overflow-x-auto border border-gray-100 rounded-md">
 <table className="min-w-full divide-y divide-gray-100 text-sm">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-4 py-3 text-left font-bold text-[11px] text-gray-500 uppercase tracking-wider">Descrição</th>
 <th className="px-4 py-3 text-left font-bold text-[11px] text-gray-500 uppercase tracking-wider">Data</th>
 <th className="px-4 py-3 text-right font-bold text-[11px] text-gray-500 uppercase tracking-wider">Valor (R$)</th>
 <th className="px-4 py-3 text-center font-bold text-[11px] text-gray-500 uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {localPermutas.map(p => (
 <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
 <td className="px-4 py-3 font-semibold text-gray-700">{p.descricao}</td>
 <td className="px-4 py-3 text-gray-500 font-medium">{formatDateForDisplay(p.data_registro)}</td>
 <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(p.valor_permutado)}</td>
 <td className="px-4 py-3 text-center"><button onClick={() => handleDeletePermuta(p.id)} disabled={loading} className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" title="Excluir"><FontAwesomeIcon icon={faTrash} size="xs" /></button></td>
 </tr>
 ))}
 <tr className="bg-gray-50/50">
 <td className="px-4 py-3"><input type="text" placeholder="Descrição do bem" value={newPermuta.descricao} onChange={e => setNewPermuta({ ...newPermuta, descricao: e.target.value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" /></td>
 <td className="px-4 py-3"><input type="date" value={newPermuta.data_registro} onChange={e => setNewPermuta({ ...newPermuta, data_registro: e.target.value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" /></td>
 <td className="px-4 py-3"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(newPermuta.valor_permutado || '')} onAccept={(value) => setNewPermuta({ ...newPermuta, valor_permutado: value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors text-right" /></td>
 <td className="px-4 py-3 text-center"><button onClick={handleAddPermuta} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-xs">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faPlus} /> Add</>}</button></td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>

 {/* --- CONTEÚDO DA TELA (Cronograma de Parcelas) --- */}
 <div className="space-y-4 pt-8 border-t border-gray-100">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">Cronograma de Parcelas</h3>
 <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
 <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="p-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-grow md:flex-grow-0">
 <option value="" disabled>Assinatura do Responsável</option>
 {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
 </select>
 <button onClick={() => window.print()} disabled={!selectedSignatoryId} className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-md font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 flex-grow md:flex-grow-0 text-xs"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
 <button onClick={handleProvisionarLancamentos} disabled={!hasPendingParcelsToProvision || isProvisioning} className="bg-green-600 text-white px-4 py-2 rounded-md font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center gap-2 flex-grow md:flex-grow-0 text-xs"><FontAwesomeIcon icon={isProvisioning ? faSpinner : faLink} spin={isProvisioning} />{isProvisioning ? 'Sincronizando...' : 'Sincronizar'}</button>
 </div>
 </div>

 {/* --- Alerta de Sincronia (Inalterado) --- */}
 {Math.abs(diferencaDeSincronia) > 0.01 && (
 <div className="p-3 bg-amber-50 text-amber-800 border border-amber-100 rounded-md flex items-center gap-3 text-xs font-semibold">
 <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
 <span>O Saldo Remanescente no banco está <strong>{formatCurrency(diferencaDeSincronia)}</strong> diferente do calculado. Salve o plano para corrigir.</span>
 </div>
 )}

 <div className="overflow-x-auto border border-gray-100 rounded-md">
 <table className="min-w-full divide-y divide-gray-100 text-sm">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-4 py-3 text-center font-bold text-[11px] text-gray-500 uppercase tracking-wider w-12">FIN.</th>
 <th className="px-4 py-3 text-left font-bold text-[11px] text-gray-500 uppercase tracking-wider w-2/5">Descrição</th>
 <th className="px-4 py-3 text-left font-bold text-[11px] text-gray-500 uppercase tracking-wider">Tipo</th>
 <th className="px-4 py-3 text-left font-bold text-[11px] text-gray-500 uppercase tracking-wider">Vencimento</th>
 <th className="px-4 py-3 text-right font-bold text-[11px] text-gray-500 uppercase tracking-wider">Valor</th>
 <th className="px-4 py-3 text-center font-bold text-[11px] text-gray-500 uppercase tracking-wider">Status</th>
 <th className="px-4 py-3 text-center font-bold text-[11px] text-gray-500 uppercase tracking-wider">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {/* --- Mapeamento das parcelas (Inalterado) --- */}
 {parcelasOrdenadas.map(p => {
 const statusInfo = getParcelaStatus(p);
 let dateClass = statusInfo.text === 'Atrasada' ? 'text-red-500 font-bold' : 'text-gray-500 font-medium';
 return (editingParcelaId === p.id ? (<tr key={p.id} className="bg-blue-50/30"> <td className="px-4 py-3"></td> <td className="px-4 py-3"><input type="text" value={editingParcelaData.descricao} onChange={e => handleEditingParcelaChange('descricao', e.target.value)} className="w-full p-2 bg-white border border-blue-400 text-sm font-bold text-gray-700 rounded-md focus:outline-none transition-colors" /></td> <td className="px-4 py-3 font-semibold text-gray-600">{p.tipo}</td> <td className="px-4 py-3"><input type="date" value={formatDateForInput(editingParcelaData.data_vencimento)} onChange={e => handleEditingParcelaChange('data_vencimento', e.target.value)} className="w-full p-2 bg-white border border-blue-400 text-sm font-bold text-gray-700 rounded-md focus:outline-none transition-colors" /></td>
 <td className="px-4 py-3"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(editingParcelaData.valor_parcela || '')} onAccept={(value) => handleEditingParcelaChange('valor_parcela', value)} className="w-full p-2 bg-white border border-blue-400 text-sm font-bold text-gray-700 rounded-md focus:outline-none transition-colors text-right" /></td>
 <td className="px-4 py-3 text-center font-bold text-gray-700">{p.status_pagamento}</td> <td className="px-4 py-3 text-center"> <div className="flex justify-center items-center gap-2"> <button onClick={() => handleSaveEditingParcela(p.id)} disabled={loading} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors" title="Salvar"><FontAwesomeIcon icon={faSave} size="xs" /></button> <button onClick={handleCancelEditingParcela} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Cancelar"><FontAwesomeIcon icon={faTimes} size="xs" /></button> </div> </td> </tr>) : (<tr key={p.id} className="hover:bg-blue-50/20 transition-colors group"> <td className="px-4 py-3 text-center">{p.lancamento_id && <FontAwesomeIcon icon={faLink} size="xs" className="text-green-500" title={`Vinculado #${p.lancamento_id}`} />}</td> <td className="px-4 py-3 font-bold text-gray-700">{p.descricao}</td> <td className="px-4 py-3 text-gray-500 font-medium">{p.tipo}</td> <td className={`px-4 py-3 whitespace-nowrap ${dateClass}`}>{formatDateForDisplay(p.data_vencimento)}</td> <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(p.valor_parcela)}</td> <td className="px-4 py-3 text-center"> <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shadow-sm ${statusInfo.className.replace('text-800', 'text-600').replace('bg-100', 'bg-50')}`}> {statusInfo.text} </span> </td> <td className="px-4 py-3 text-center"> <div className="flex justify-center items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => handleDuplicateParcela(p.id)} disabled={loading} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Duplicar"><FontAwesomeIcon icon={faCopy} size="xs" /></button> {p.status_pagamento === 'Pendente' && <button onClick={() => handleStartEditingParcela(p)} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Editar"><FontAwesomeIcon icon={faEdit} size="xs" /></button>} <button onClick={() => handleDeleteParcela(p.id)} disabled={loading} className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 transition-all shadow-sm" title="Excluir"><FontAwesomeIcon icon={faTrash} size="xs" /></button> </div> </td> </tr>))
 })}

 {/* --- Formulário de Nova Parcela (Inalterado) --- */}
 <tr className="bg-gray-50/50 border-t border-gray-100"> <td className="px-4 py-3"></td> <td className="px-4 py-3"><input type="text" placeholder="Adicionar parcela adicional..." value={newParcela.descricao} onChange={e => setNewParcela({ ...newParcela, descricao: e.target.value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" /></td> <td className="px-4 py-3 text-gray-500 font-medium">Adicional</td> <td className="px-4 py-3"><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({ ...newParcela, data_vencimento: e.target.value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" /></td>
 <td className="px-4 py-3"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }} unmask={true} value={String(newParcela.valor_parcela || '')} onAccept={(value) => setNewParcela({ ...newParcela, valor_parcela: value })} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors text-right" /></td>
 <td className="px-4 py-3 text-center text-gray-400 font-bold text-[10px] uppercase">A Pagar</td> <td className="px-4 py-3 text-center"><button onClick={handleAddParcela} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-xs">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faPlus} /> Add</>}</button></td> </tr>
 </tbody>

 <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-sm">
 <tr>
 <td colSpan="6" className="text-right px-4 py-3 font-semibold text-gray-500">Total Parcelas (Entrada + Obra + Adicionais):</td>
 <td colSpan="2" className="text-right px-4 py-3 font-bold text-gray-800">{formatCurrency(totalParcelasNormais)}</td>
 </tr>

 <tr className="border-t border-gray-100">
 <td colSpan="6" className="text-right px-4 py-3 font-bold text-blue-600">{displaySaldoRemanescente.descricao}:</td>
 <td colSpan="2" className="text-right px-4 py-3 font-bold text-blue-600">{formatCurrency(displaySaldoRemanescente.valor_parcela)}</td>
 </tr>

 <tr className="bg-gray-100 border-t-2 border-gray-200">
 <td colSpan="6" className="text-right px-4 py-4 text-sm font-bold text-gray-700 uppercase">VALOR TOTAL CONTRATO:</td>
 <td colSpan="2" className="text-right px-4 py-4 text-sm font-bold text-gray-800">{formatCurrency(valorTotalContrato)}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 </div>
 </div>
 );
}
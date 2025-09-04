// Caminho: components/contratos/CronogramaFinanceiro.js

"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle, faPen, faTimes, faCopy, faExchangeAlt, faLink, faPrint } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import PlanoPagamentoPrint from './PlanoPagamentoPrint';

// --- FUNÇÕES DE FORMATAÇÃO E ESTILO ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0] : '';
const formatDateForDisplay = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

const getParcelaStatus = (parcela) => {
    if (parcela.status_pagamento === 'Pago') {
        return { text: 'Paga', className: 'bg-green-100 text-green-800' };
    }
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dueDate = new Date(parcela.data_vencimento + 'T00:00:00Z');
    if (dueDate < todayUTC) {
        return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
    }
    return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
};

export default function CronogramaFinanceiro({ contrato, onUpdate }) {
    const { id: contratoId, contrato_parcelas: parcelas, contrato_permutas: permutas, valor_final_venda: valorTotalContrato } = contrato;
    
    const supabase = createClient();
    const [localParcelas, setLocalParcelas] = useState(parcelas || []);
    const [localPermutas, setLocalPermutas] = useState(permutas || []);
    const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
    const [editingParcelaId, setEditingParcelaId] = useState(null);
    const [editingParcelaData, setEditingParcelaData] = useState({});
    const [newPermuta, setNewPermuta] = useState({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] });
    const [loading, setLoading] = useState(false);
    const [isProvisioning, setIsProvisioning] = useState(false);

    useEffect(() => { setLocalParcelas(parcelas || []); setLocalPermutas(permutas || []); }, [parcelas, permutas]);

    const totalParcelas = useMemo(() => localParcelas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0), [localParcelas]);
    const totalPermutas = useMemo(() => localPermutas.reduce((sum, p) => sum + parseFloat(p.valor_permutado || 0), 0), [localPermutas]);
    const diferenca = valorTotalContrato - totalParcelas - totalPermutas;
    const hasPendingParcelsToProvision = useMemo(() => localParcelas.some(p => !p.lancamento_id && p.status_pagamento === 'Pendente'), [localParcelas]);

    const handleProvisionarLancamentos = async () => {
        setIsProvisioning(true);
        const promise = supabase.rpc('provisionar_parcelas_contrato', { p_contrato_id: contratoId });
        toast.promise(promise, {
            loading: 'Provisionando lançamentos...',
            success: (response) => { onUpdate(); return "Lançamentos provisionados com sucesso!"; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsProvisioning(false)
        });
    };

    const handleAddParcela = async () => {
        if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) {
            toast.error("Preencha todos os campos para adicionar a parcela.");
            return;
        }
        setLoading(true);
        const valorNumerico = parseFloat(newParcela.valor_parcela) || 0;
        const { data: insertedData, error: insertError } = await supabase.from('contrato_parcelas').insert({ contrato_id: contratoId, ...newParcela, valor_parcela: valorNumerico }).select().single();
        if (insertError) { toast.error("Erro ao adicionar parcela: " + insertError.message); setLoading(false); return; }
        toast.success("Parcela adicionada ao contrato!");
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: insertedData.id });
        if (syncError) { toast.warning("Parcela salva, mas houve um erro ao criar o lançamento financeiro: " + syncError.message); } else { toast.success("Lançamento financeiro criado/vinculado automaticamente!"); }
        setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
        onUpdate();
        setLoading(false);
    };

    const handleSaveEditingParcela = async (parcelaId) => {
        setLoading(true);
        const { id, ...updateData } = editingParcelaData;
        updateData.valor_parcela = parseFloat(String(updateData.valor_parcela || '')) || 0;
        const { error: updateError } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);
        if (updateError) { toast.error("Erro ao salvar: " + updateError.message); setLoading(false); return; }
        toast.success("Parcela atualizada!");
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: parcelaId });
        if (syncError) { toast.warning("Parcela salva, mas houve um erro ao sincronizar com o financeiro: " + syncError.message); } else { toast.success("Lançamento financeiro atualizado automaticamente!"); }
        setEditingParcelaId(null);
        onUpdate();
        setLoading(false);
    };
    
    const handleDeleteParcela = async (parcelaId) => {
        if (!window.confirm("Tem certeza? O lançamento financeiro vinculado (se houver) também será excluído.")) return;
        setLoading(true);
        const promise = supabase.rpc('excluir_parcela_e_lancamento', { p_parcela_id: parcelaId });
        toast.promise(promise, {
            loading: 'Excluindo parcela e vínculo...',
            success: () => { onUpdate(); return "Parcela excluída com sucesso."; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setLoading(false)
        });
    };
    
    const handleDuplicateParcela = async (parcelaId) => {
        if (!window.confirm("Deseja criar uma cópia desta parcela?")) return;
        const promise = new Promise(async (resolve, reject) => {
            const { data, error } = await supabase.rpc('duplicar_parcela_contrato', { p_parcela_id: parcelaId });
            if (error) return reject(new Error(error.message));
            if (data && data.success) resolve(data.message);
            else reject(new Error(data.message || 'Erro desconhecido.'));
        });
        toast.promise(promise, {
            loading: 'Duplicando...',
            success: (message) => { onUpdate(); return message; },
            error: (err) => `Erro: ${err.message}`
        });
    };

    const handleAddPermuta = async () => {
        if (!newPermuta.descricao || !newPermuta.valor_permutado || !newPermuta.data_registro) return toast.error("Preencha todos os campos da permuta.");
        setLoading(true);
        const valorString = String(newPermuta.valor_permutado || '');
        const valorNumerico = parseFloat(valorString.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
        const { error } = await supabase.from('contrato_permutas').insert({ contrato_id: contratoId, descricao: newPermuta.descricao, valor_permutado: valorNumerico, data_registro: newPermuta.data_registro });
        if (error) { toast.error("Erro: " + error.message); } 
        else { toast.success("Permuta adicionada!"); setNewPermuta({ descricao: '', valor_permutado: '', data_registro: new Date().toISOString().split('T')[0] }); onUpdate(); }
        setLoading(false);
    };

    const handleDeletePermuta = async (permutaId) => {
        if (!window.confirm("Tem certeza?")) return;
        setLoading(true);
        const { error } = await supabase.from('contrato_permutas').delete().eq('id', permutaId);
        if (error) { toast.error("Erro: " + error.message); }
        else { toast.success("Permuta excluída."); onUpdate(); }
        setLoading(false);
    };
    
    const handleStartEditingParcela = (parcela) => { setEditingParcelaId(parcela.id); setEditingParcelaData(parcela); };
    const handleCancelEditingParcela = () => { setEditingParcelaId(null); setEditingParcelaData({}); };
    const handleEditingParcelaChange = (field, value) => setEditingParcelaData(prev => ({ ...prev, [field]: value }));
    
    return (
        <div className="printable-container">
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 1cm; }
                    body * { visibility: hidden; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
                    .no-print { display: none !important; }
                    table { font-size: 9pt !important; }
                }
            `}</style>
            
            <div className="hidden print:block printable-area">
                <PlanoPagamentoPrint contrato={contrato} />
            </div>

            <div className="no-print bg-white p-6 rounded-lg shadow-md border space-y-6">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExchangeAlt} /> Permutas Registradas
                    </h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                                    <th className="px-4 py-2 text-left font-semibold">Data</th>
                                    <th className="px-4 py-2 text-right font-semibold">Valor (R$)</th>
                                    <th className="px-4 py-2 text-center font-semibold">Ações</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y">
                                {localPermutas.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-4 py-3">{p.descricao}</td>
                                        <td className="px-4 py-3">{formatDateForDisplay(p.data_registro)}</td>
                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.valor_permutado)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleDeletePermuta(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-2"><input type="text" placeholder="Descrição do bem" value={newPermuta.descricao} onChange={e => setNewPermuta({...newPermuta, descricao: e.target.value})} className="p-2 border rounded w-full"/></td>
                                    <td className="px-4 py-2"><input type="date" value={newPermuta.data_registro} onChange={e => setNewPermuta({...newPermuta, data_registro: e.target.value})} className="p-2 border rounded w-full"/></td>
                                    <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newPermuta.valor_permutado || '')} onAccept={(value) => setNewPermuta({...newPermuta, valor_permutado: value})} className="p-2 border rounded w-full text-right"/></td>
                                    <td className="px-4 py-2 text-center"><button onClick={handleAddPermuta} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-4 pt-6 border-t">
                     <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faFileInvoiceDollar} /> Cronograma de Parcelas</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => window.print()} className="bg-gray-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-700 flex items-center gap-2">
                                <FontAwesomeIcon icon={faPrint} /> Imprimir Plano
                            </button>
                            <button onClick={handleProvisionarLancamentos} disabled={!hasPendingParcelsToProvision || isProvisioning} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                                <FontAwesomeIcon icon={isProvisioning ? faSpinner : faLink} spin={isProvisioning} />
                                {isProvisioning ? 'Sincronizando...' : 'Sincronizar'}
                            </button>
                        </div>
                    </div>
                    {Math.abs(diferenca) > 0.01 && (<div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-3 text-sm"><FontAwesomeIcon icon={faExclamationTriangle} /><span>A soma difere do valor do contrato. Diferença: <strong>{formatCurrency(diferenca)}</strong></span></div>)}
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-center font-bold uppercase w-12">FIN.</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase w-2/5">Descrição</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left font-bold uppercase">Vencimento</th>
                                    <th className="px-4 py-3 text-right font-bold uppercase">Valor</th>
                                    <th className="px-4 py-3 text-center font-bold uppercase">Status</th>
                                    <th className="px-4 py-3 text-center font-bold uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y">
                                {localParcelas.map(p => {
                                    const statusInfo = getParcelaStatus(p);
                                    let dateClass = '';
                                    if (statusInfo.text === 'Atrasada') dateClass = 'text-red-600 font-bold';
                                    return ( editingParcelaId === p.id ? ( <tr key={p.id} className="bg-yellow-50"> <td className="px-4 py-2"></td> <td className="px-4 py-2"><input type="text" value={editingParcelaData.descricao} onChange={e => handleEditingParcelaChange('descricao', e.target.value)} className="p-2 border rounded w-full bg-yellow-100"/></td> <td className="px-4 py-2">{p.tipo}</td> <td className="px-4 py-2"><input type="date" value={formatDateForInput(editingParcelaData.data_vencimento)} onChange={e => handleEditingParcelaChange('data_vencimento', e.target.value)} className="p-2 border rounded w-full bg-yellow-100"/></td> <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(editingParcelaData.valor_parcela || '')} onAccept={(value) => handleEditingParcelaChange('valor_parcela', value)} className="p-2 border rounded w-full text-right bg-yellow-100"/></td> <td className="px-4 py-2 text-center">{p.status_pagamento}</td> <td className="px-4 py-2 text-center"> <div className="flex justify-center items-center gap-3"> <button onClick={() => handleSaveEditingParcela(p.id)} disabled={loading} className="text-green-600" title="Salvar"><FontAwesomeIcon icon={faSave} /></button> <button onClick={handleCancelEditingParcela} className="text-gray-500" title="Cancelar"><FontAwesomeIcon icon={faTimes} /></button> </div> </td> </tr> ) : ( <tr key={p.id} className="hover:bg-gray-50"> <td className="px-4 py-3 text-center">{p.lancamento_id && <FontAwesomeIcon icon={faLink} className="text-green-500" title={`Vinculado ao Lançamento #${p.lancamento_id}`} />}</td> <td className="px-4 py-3 font-medium">{p.descricao}</td> <td className="px-4 py-3 text-gray-600">{p.tipo}</td> <td className={`px-4 py-3 whitespace-nowrap ${dateClass}`}>{formatDateForDisplay(p.data_vencimento)}</td> <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(p.valor_parcela)}</td> <td className="px-4 py-3 text-center"> <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className}`}> {statusInfo.text.toUpperCase()} </span> </td> <td className="px-4 py-3 text-center"> <div className="flex justify-center items-center gap-4"> <button onClick={() => handleDuplicateParcela(p.id)} disabled={loading} className="text-gray-500 hover:text-gray-700" title="Duplicar"><FontAwesomeIcon icon={faCopy} /></button> {p.status_pagamento === 'Pendente' && <button onClick={() => handleStartEditingParcela(p)} className="text-blue-600 hover:text-blue-800" title="Editar"><FontAwesomeIcon icon={faPen} /></button>} <button onClick={() => handleDeleteParcela(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button> </div> </td> </tr> ) )
                                })}
                                <tr className="bg-gray-50"> <td className="px-4 py-2"></td> <td className="px-4 py-2"><input type="text" placeholder="Nova Parcela Adicional" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="p-2 border rounded w-full"/></td> <td className="px-4 py-2 text-gray-600">Adicional</td> <td className="px-4 py-2"><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({...newParcela, data_vencimento: e.target.value})} className="p-2 border rounded w-full"/></td> <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newParcela.valor_parcela || '')} onAccept={(value) => setNewParcela({...newParcela, valor_parcela: value})} className="p-2 border rounded w-full text-right"/></td> <td className="px-4 py-2 text-center text-gray-600">Pendente</td> <td className="px-4 py-2 text-center"><button onClick={handleAddParcela} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td> </tr>
                            </tbody>
                             <tfoot className="bg-gray-200 font-bold">
                                <tr>
                                    <td colSpan="6" className="text-right px-4 py-2">Total (Parcelas + Permutas):</td>
                                    <td colSpan="2" className="text-right px-4 py-2">{formatCurrency(totalParcelas + totalPermutas)}</td>
                                </tr>
                                <tr className={Math.abs(diferenca) > 0.01 ? 'bg-red-200' : ''}>
                                    <td colSpan="6" className="text-right px-4 py-2">Diferença para o Total do Contrato:</td>
                                    <td colSpan="2" className="text-right px-4 py-2">{formatCurrency(diferenca)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
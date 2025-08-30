"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle, faPen, faTimes, faCopy, faExchangeAlt, faLink } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0] : '';
const formatDateForDisplay = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

export default function CronogramaFinanceiro({ contratoId, parcelas, permutas, valorTotalContrato, onUpdate }) {
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
            success: (response) => { onUpdate(); return response; },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsProvisioning(false)
        });
    };

    // ##### ALTERAÇÃO AQUI (Adicionar) #####
    const handleAddParcela = async () => {
        if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) {
            toast.error("Preencha todos os campos para adicionar a parcela.");
            return;
        }
        setLoading(true);
        const valorNumerico = parseFloat(String(newParcela.valor_parcela)) || 0;
        
        // 1. Insere a nova parcela no banco
        const { data: insertedData, error: insertError } = await supabase.from('contrato_parcelas').insert({
            contrato_id: contratoId, ...newParcela, valor_parcela: valorNumerico
        }).select().single();

        if (insertError) {
            toast.error("Erro ao adicionar parcela: " + insertError.message);
            setLoading(false);
            return;
        }
        
        toast.success("Parcela adicionada ao contrato!");
        
        // 2. Chama a função de sincronização para criar o lançamento financeiro
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: insertedData.id });
        if (syncError) { toast.warning("Parcela salva, mas houve um erro ao criar o lançamento financeiro: " + syncError.message); }
        else { toast.success("Lançamento financeiro criado/vinculado automaticamente!"); }

        setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
        onUpdate();
        setLoading(false);
    };

    // ##### ALTERAÇÃO AQUI (Salvar Edição) #####
    const handleSaveEditingParcela = async (parcelaId) => {
        setLoading(true);
        const { id, ...updateData } = editingParcelaData;
        updateData.valor_parcela = parseFloat(String(updateData.valor_parcela)) || 0;

        // 1. Atualiza a parcela no banco
        const { error: updateError } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);

        if (updateError) {
            toast.error("Erro ao salvar: " + updateError.message);
            setLoading(false);
            return;
        }
        toast.success("Parcela atualizada!");

        // 2. Chama a função de sincronização para atualizar o lançamento financeiro
        const { error: syncError } = await supabase.rpc('sincronizar_parcela_com_lancamento', { p_parcela_id: parcelaId });

        if (syncError) { toast.warning("Parcela salva, mas houve um erro ao sincronizar com o financeiro: " + syncError.message); }
        else { toast.success("Lançamento financeiro atualizado automaticamente!"); }
        
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
            success: (response) => { onUpdate(); return response; },
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
        const valorNumerico = parseFloat(String(newPermuta.valor_permutado).replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
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

    // O restante do componente (JSX para renderizar a tabela) permanece igual
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-6">
            {/* Seção de Permutas */}
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
                                    <td className="px-4 py-2">{p.descricao}</td>
                                    <td className="px-4 py-2">{formatDateForDisplay(p.data_registro)}</td>
                                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.valor_permutado)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => handleDeletePermuta(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50">
                                <td className="px-4 py-2"><input type="text" placeholder="Descrição do bem" value={newPermuta.descricao} onChange={e => setNewPermuta({...newPermuta, descricao: e.target.value})} className="p-1 border rounded w-full"/></td>
                                <td className="px-4 py-2"><input type="date" value={newPermuta.data_registro} onChange={e => setNewPermuta({...newPermuta, data_registro: e.target.value})} className="p-1 border rounded w-full"/></td>
                                <td className="px-4 py-2"><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newPermuta.valor_permutado || '')} onAccept={(value) => setNewPermuta({...newPermuta, valor_permutado: value})} className="p-1 border rounded w-full text-right"/></td>
                                <td className="px-4 py-2 text-center"><button onClick={handleAddPermuta} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Seção de Parcelas */}
            <div className="space-y-4 pt-6 border-t">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faFileInvoiceDollar} /> Parcelas Geradas</h3>
                    <button onClick={handleProvisionarLancamentos} disabled={!hasPendingParcelsToProvision || isProvisioning} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                        <FontAwesomeIcon icon={isProvisioning ? faSpinner : faLink} spin={isProvisioning} />
                        {isProvisioning ? 'Sincronizando...' : 'Sincronizar Tudo'}
                    </button>
                </div>
                {Math.abs(diferenca) > 0.01 && (<div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-3 text-sm"><FontAwesomeIcon icon={faExclamationTriangle} /><span>A soma difere do valor do contrato. Diferença: <strong>{formatCurrency(diferenca)}</strong></span></div>)}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 text-center font-semibold">FIN.</th>
                                <th className="px-4 py-2 text-left font-semibold">Descrição</th>
                                <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                                <th className="px-4 py-2 text-left font-semibold">Vencimento</th>
                                <th className="px-4 py-2 text-right font-semibold">Valor</th>
                                <th className="px-4 py-2 text-center font-semibold">Status</th>
                                <th className="px-4 py-2 text-center font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y">
                            {localParcelas.map(p => (
                                editingParcelaId === p.id ? (
                                    <tr key={p.id} className="bg-yellow-50">
                                        <td></td>
                                        <td><input type="text" value={editingParcelaData.descricao} onChange={e => handleEditingParcelaChange('descricao', e.target.value)} className="p-1 border rounded w-full"/></td>
                                        <td>{p.tipo}</td>
                                        <td><input type="date" value={formatDateForInput(editingParcelaData.data_vencimento)} onChange={e => handleEditingParcelaChange('data_vencimento', e.target.value)} className="p-1 border rounded w-full"/></td>
                                        <td><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(editingParcelaData.valor_parcela || '')} onAccept={(value) => handleEditingParcelaChange('valor_parcela', value)} className="p-1 border rounded w-full text-right"/></td>
                                        <td>{p.status_pagamento}</td>
                                        <td className="text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => handleSaveEditingParcela(p.id)} disabled={loading} className="text-green-600"><FontAwesomeIcon icon={faSave} /></button>
                                                <button onClick={handleCancelEditingParcela} className="text-gray-500"><FontAwesomeIcon icon={faTimes} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={p.id}>
                                        <td className="text-center">{p.lancamento_id && <FontAwesomeIcon icon={faLink} className="text-green-500" title={`Vinculado: Lanç. #${p.lancamento_id}`} />}</td>
                                        <td>{p.descricao}</td>
                                        <td>{p.tipo}</td>
                                        <td>{formatDateForDisplay(p.data_vencimento)}</td>
                                        <td className="text-right font-medium">{formatCurrency(p.valor_parcela)}</td>
                                        <td className="text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${p.status_pagamento === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status_pagamento}</span></td>
                                        <td className="text-center">
                                            <div className="flex justify-center items-center gap-3">
                                                <button onClick={() => handleDuplicateParcela(p.id)} disabled={loading} className="text-gray-500 hover:text-gray-700" title="Duplicar"><FontAwesomeIcon icon={faCopy} /></button>
                                                {p.status_pagamento === 'Pendente' && <button onClick={() => handleStartEditingParcela(p)} className="text-blue-600 hover:text-blue-800" title="Editar"><FontAwesomeIcon icon={faPen} /></button>}
                                                <button onClick={() => handleDeleteParcela(p.id)} disabled={loading} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            ))}
                            <tr className="bg-gray-50">
                                <td></td>
                                <td><input type="text" placeholder="Nova Parcela" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="p-1 border rounded w-full"/></td>
                                <td>Adicional</td>
                                <td><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({...newParcela, data_vencimento: e.target.value})} className="p-1 border rounded w-full"/></td>
                                <td><IMaskInput mask="R$ num" blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}} unmask={true} value={String(newParcela.valor_parcela || '')} onAccept={(value) => setNewParcela({...newParcela, valor_parcela: value})} className="p-1 border rounded w-full text-right"/></td>
                                <td className="text-center">Pendente</td>
                                <td className="text-center"><button onClick={handleAddParcela} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600">{loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Add</>}</button></td>
                            </tr>
                        </tbody>
                        <tfoot className="bg-gray-200 font-bold">
                            <tr>
                                <td colSpan="4" className="text-right px-4 py-2">Total (Parcelas + Permutas):</td>
                                <td className="text-right px-4 py-2">{formatCurrency(totalParcelas + totalPermutas)}</td>
                                <td colSpan="2"></td>
                            </tr>
                            <tr className={Math.abs(diferenca) > 0.01 ? 'bg-red-200' : ''}>
                                <td colSpan="4" className="text-right px-4 py-2">Diferença para o Total do Contrato:</td>
                                <td className="text-right px-4 py-2">{formatCurrency(diferenca)}</td>
                                <td colSpan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle, faPen, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// Funções de formatação (ajudam a exibir os dados de forma legível)
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    // Garante que a data seja tratada como UTC para evitar problemas de fuso horário
    return new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0];
};
// ***** FUNÇÃO CORRIGIDA *****
const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Adicionado timeZone: 'UTC' para evitar a conversão de fuso horário
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};


export default function CronogramaFinanceiro({ contratoId, parcelas, valorTotalContrato, onUpdate }) {
    const supabase = createClient();
    const [localParcelas, setLocalParcelas] = useState(parcelas || []);
    const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [loading, setLoading] = useState(false);

    // Atualiza o estado local sempre que as parcelas do contrato principal mudarem
    useEffect(() => {
        setLocalParcelas(parcelas || []);
    }, [parcelas]);

    // Calcula o valor total das parcelas listadas e a diferença para o valor total do contrato
    const totalParcelas = useMemo(() => localParcelas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0), [localParcelas]);
    const diferenca = valorTotalContrato - totalParcelas;

    // Função para adicionar uma nova parcela manualmente
    const handleAddParcela = async () => {
        if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) {
            toast.error("Preencha Descrição, Vencimento e Valor para adicionar a parcela.");
            return;
        }
        setLoading(true);
        const valorNumerico = parseFloat(String(newParcela.valor_parcela)) || 0;

        const { error } = await supabase.from('contrato_parcelas').insert({
            contrato_id: contratoId,
            ...newParcela,
            valor_parcela: valorNumerico
        });
        if (error) { toast.error("Erro ao adicionar parcela: " + error.message); }
        else { toast.success("Parcela adicionada!"); setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' }); onUpdate(); }
        setLoading(false);
    };

    // Função para excluir uma parcela
    const handleDeleteParcela = async (parcelaId) => {
        if (!window.confirm("Tem certeza que deseja excluir esta parcela?")) return;
        setLoading(true);
        const { error } = await supabase.from('contrato_parcelas').delete().eq('id', parcelaId);
        if (error) { toast.error("Erro ao excluir: " + error.message); }
        else { toast.success("Parcela excluída."); onUpdate(); }
        setLoading(false);
    };

    // Funções para controlar a edição em linha
    const handleStartEditing = (parcela) => { setEditingRowId(parcela.id); setEditingData(parcela); };
    const handleCancelEditing = () => { setEditingRowId(null); setEditingData({}); };
    const handleEditingChange = (field, value) => setEditingData(prev => ({ ...prev, [field]: value }));
    
    // Função para salvar a edição em linha
    const handleSaveEditing = async (parcelaId) => {
        setLoading(true);
        const { id, ...updateData } = editingData;
        const valorNumerico = parseFloat(String(updateData.valor_parcela)) || 0;
        updateData.valor_parcela = valorNumerico;

        const { error } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);
        if (error) { toast.error("Erro ao salvar: " + error.message); }
        else { toast.success("Parcela atualizada!"); setEditingRowId(null); onUpdate(); }
        setLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileInvoiceDollar} /> Parcelas Geradas
            </h3>
            {/* Aviso de diferença de valores */}
            {Math.abs(diferenca) > 0.01 && (
                <div className="p-3 bg-yellow-100 text-yellow-800 rounded-md flex items-center gap-3 text-sm">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>A soma das parcelas ({formatCurrency(totalParcelas)}) é <strong>diferente</strong> do valor do contrato. Diferença: <strong>{formatCurrency(diferenca)}</strong></span>
                </div>
            )}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
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
                            editingRowId === p.id ? (
                                // LINHA DE EDIÇÃO
                                <tr key={p.id} className="bg-yellow-50">
                                    <td className="px-4 py-2"><input type="text" value={editingData.descricao} onChange={e => handleEditingChange('descricao', e.target.value)} className="p-1 border rounded w-full"/></td>
                                    <td className="px-4 py-2">{p.tipo}</td>
                                    <td className="px-4 py-2"><input type="date" value={formatDateForInput(editingData.data_vencimento)} onChange={e => handleEditingChange('data_vencimento', e.target.value)} className="p-1 border rounded w-full"/></td>
                                    <td className="px-4 py-2">
                                        <IMaskInput
                                            mask="R$ num"
                                            blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}}
                                            unmask={true}
                                            value={String(editingData.valor_parcela)}
                                            onAccept={(value) => handleEditingChange('valor_parcela', value)}
                                            className="p-1 border rounded w-full text-right"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">{p.status_pagamento}</td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            <button onClick={() => handleSaveEditing(p.id)} disabled={loading} className="text-green-600"><FontAwesomeIcon icon={faSave} /></button>
                                            <button onClick={handleCancelEditing} className="text-gray-500"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // LINHA DE VISUALIZAÇÃO
                                <tr key={p.id}>
                                    <td className="px-4 py-2">{p.descricao}</td>
                                    <td className="px-4 py-2">{p.tipo}</td>
                                    <td className="px-4 py-2">{formatDateForDisplay(p.data_vencimento)}</td>
                                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.valor_parcela)}</td>
                                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${p.status_pagamento === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status_pagamento}</span></td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            {p.status_pagamento === 'Pendente' && <button onClick={() => handleStartEditing(p)} className="text-blue-600"><FontAwesomeIcon icon={faPen} /></button>}
                                            <button onClick={() => handleDeleteParcela(p.id)} disabled={loading} className="text-red-500"><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        ))}
                        {/* Linha para adicionar nova parcela */}
                        <tr className="bg-gray-50">
                            <td className="px-4 py-2"><input type="text" placeholder="Nova Parcela Adicional" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="p-1 border rounded w-full"/></td>
                            <td className="px-4 py-2 text-gray-500">Adicional</td>
                            <td className="px-4 py-2"><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({...newParcela, data_vencimento: e.target.value})} className="p-1 border rounded w-full"/></td>
                            <td className="px-4 py-2">
                                <IMaskInput
                                    mask="R$ num"
                                    blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}}
                                    unmask={true}
                                    value={newParcela.valor_parcela}
                                    onAccept={(value) => setNewParcela({...newParcela, valor_parcela: value})}
                                    className="p-1 border rounded w-full text-right"
                                />
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">Pendente</td>
                            <td className="px-4 py-2 text-center">
                                <button onClick={handleAddParcela} disabled={loading} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-green-600">
                                    {loading ? <FontAwesomeIcon icon={faSpinner} spin/> : <><FontAwesomeIcon icon={faPlus}/> Adicionar</>}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr>
                            <td colSpan="3" className="px-4 py-2 text-right">Total das Parcelas:</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(totalParcelas)}</td>
                            <td colSpan="2"></td>
                        </tr>
                        <tr className={Math.abs(diferenca) > 0.01 ? 'bg-red-200' : ''}>
                            <td colSpan="3" className="px-4 py-2 text-right">Saldo Remanescente (Planejado):</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(diferenca)}</td>
                            <td colSpan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
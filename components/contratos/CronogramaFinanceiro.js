// components/contratos/CronogramaFinanceiro.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faSpinner, faSave, faFileInvoiceDollar, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// Funções auxiliares de formatação
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    // Garante que a data seja tratada como UTC para evitar problemas de fuso horário
    return new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0];
};

export default function CronogramaFinanceiro({ contratoId, initialParcelas, valorTotalContrato, onUpdate }) {
    const supabase = createClient();
    const [parcelas, setParcelas] = useState(initialParcelas || []);
    const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setParcelas(initialParcelas || []);
    }, [initialParcelas]);

    const totalParcelas = useMemo(() => parcelas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0), [parcelas]);
    const diferenca = valorTotalContrato - totalParcelas;

    const handleAddParcela = async () => {
        if (!newParcela.descricao || !newParcela.data_vencimento || !newParcela.valor_parcela) {
            toast.error("Preencha todos os campos da nova parcela.");
            return;
        }
        setLoading(true);
        const { data, error } = await supabase.from('contrato_parcelas').insert({
            contrato_id: contratoId,
            ...newParcela,
            valor_parcela: parseFloat(newParcela.valor_parcela)
        }).select().single();

        if (error) {
            toast.error("Erro ao adicionar parcela: " + error.message);
        } else {
            toast.success("Parcela adicionada com sucesso!");
            setParcelas(prev => [...prev, data]);
            setNewParcela({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
            onUpdate(); // Atualiza o componente pai
        }
        setLoading(false);
    };
    
    const handleDeleteParcela = async (parcelaId) => {
        if (!window.confirm("Tem certeza que deseja excluir esta parcela?")) return;
        setLoading(true);
        const { error } = await supabase.from('contrato_parcelas').delete().eq('id', parcelaId);
        if (error) {
            toast.error("Erro ao excluir parcela: " + error.message);
        } else {
            toast.success("Parcela excluída.");
            setParcelas(prev => prev.filter(p => p.id !== parcelaId));
            onUpdate();
        }
        setLoading(false);
    };

    const handleStartEditing = (parcela) => {
        setEditingRowId(parcela.id);
        setEditingData(parcela);
    };

    const handleCancelEditing = () => {
        setEditingRowId(null);
        setEditingData({});
    };
    
    const handleSaveEditing = async (parcelaId) => {
        setLoading(true);
        const { id, created_at, updated_at, ...updateData } = editingData;
        const { error } = await supabase.from('contrato_parcelas').update(updateData).eq('id', parcelaId);
        if (error) {
            toast.error("Erro ao salvar: " + error.message);
        } else {
            toast.success("Parcela atualizada!");
            setEditingRowId(null);
            onUpdate();
        }
        setLoading(false);
    };

    return (
        <div className="bg-gray-50 p-6 rounded-lg border space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faFileInvoiceDollar} /> Cronograma Financeiro
            </h3>

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
                        {parcelas.map(p => (
                            editingRowId === p.id ? (
                                // Linha em modo de edição
                                <tr key={p.id} className="bg-yellow-50">
                                    <td className="p-2"><input type="text" value={editingData.descricao} onChange={e => setEditingData({...editingData, descricao: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="text" value={editingData.tipo} onChange={e => setEditingData({...editingData, tipo: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="date" value={formatDateForInput(editingData.data_vencimento)} onChange={e => setEditingData({...editingData, data_vencimento: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={editingData.valor_parcela} onChange={e => setEditingData({...editingData, valor_parcela: e.target.value})} className="w-full p-1 border rounded text-right" /></td>
                                    <td className="p-2 text-center">
                                        <select value={editingData.status_pagamento} onChange={e => setEditingData({...editingData, status_pagamento: e.target.value})} className="w-full p-1 border rounded">
                                            <option>Pendente</option>
                                            <option>Pago</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center space-x-2">
                                        <button onClick={() => handleSaveEditing(p.id)} className="text-green-600 hover:text-green-800" disabled={loading}><FontAwesomeIcon icon={loading ? faSpinner : faSave} spin={loading} /></button>
                                        <button onClick={handleCancelEditing} className="text-gray-600 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                                    </td>
                                </tr>
                            ) : (
                                // Linha em modo de visualização
                                <tr key={p.id}>
                                    <td className="px-4 py-2">{p.descricao}</td>
                                    <td className="px-4 py-2">{p.tipo}</td>
                                    <td className="px-4 py-2">{new Date(p.data_vencimento + 'T00:00:00Z').toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.valor_parcela)}</td>
                                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 text-xs rounded-full ${p.status_pagamento === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status_pagamento}</span></td>
                                    <td className="px-4 py-2 text-center space-x-2">
                                        <button onClick={() => handleStartEditing(p)} className="text-blue-600 hover:text-blue-800"><FontAwesomeIcon icon={faPen} /></button>
                                        <button onClick={() => handleDeleteParcela(p.id)} className="text-red-500 hover:text-red-700" disabled={loading}><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            )
                        ))}
                        {/* Linha para adicionar nova parcela */}
                        <tr>
                            <td className="p-2"><input type="text" placeholder="Descrição" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="w-full p-1 border rounded"/></td>
                            <td className="p-2">
                                <select value={newParcela.tipo} onChange={e => setNewParcela({...newParcela, tipo: e.target.value})} className="w-full p-1 border rounded">
                                    <option>Adicional</option><option>Entrada</option><option>Obra</option><option>Financiamento</option><option>Permuta</option>
                                </select>
                            </td>
                            <td className="p-2"><input type="date" value={newParcela.data_vencimento} onChange={e => setNewParcela({...newParcela, data_vencimento: e.target.value})} className="w-full p-1 border rounded"/></td>
                            <td className="p-2"><input type="number" step="0.01" placeholder="Valor" value={newParcela.valor_parcela} onChange={e => setNewParcela({...newParcela, valor_parcela: e.target.value})} className="w-full p-1 border rounded text-right"/></td>
                            <td className="p-2"></td>
                            <td className="p-2 text-center">
                                <button onClick={handleAddParcela} className="bg-blue-500 text-white rounded-md px-3 py-1 hover:bg-blue-600" disabled={loading}>
                                    <FontAwesomeIcon icon={loading ? faSpinner : faPlus} spin={loading} /> Adicionar
                                </button>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                        <tr>
                            <td colSpan="3" className="px-4 py-2 text-right">VALOR TOTAL DO CONTRATO:</td>
                            <td colSpan="3" className="px-4 py-2 text-left">{formatCurrency(valorTotalContrato)}</td>
                        </tr>
                        <tr>
                            <td colSpan="3" className="px-4 py-2 text-right">TOTAL PARCELADO:</td>
                            <td colSpan="3" className="px-4 py-2 text-left">{formatCurrency(totalParcelas)}</td>
                        </tr>
                        <tr className={Math.abs(diferenca) > 0.01 ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}>
                            <td colSpan="3" className="px-4 py-2 text-right">DIFERENÇA:</td>
                            <td colSpan="3" className="px-4 py-2 text-left flex items-center gap-2">
                                {Math.abs(diferenca) > 0.01 && <FontAwesomeIcon icon={faExclamationTriangle} />}
                                {formatCurrency(diferenca)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileInvoiceDollar, faFileSignature, faIdCard, faSpinner, faPlus, 
    faTrash, faSave, faCalculator, faPen, faTimes, faExclamationTriangle,
    faSyncAlt
} from '@fortawesome/free-solid-svg-icons';
import ContratoAnexos from './ContratoAnexos';
import { IMaskInput } from 'react-imask';

// Funções Auxiliares (sem alteração)
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR');
};
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00Z').toISOString().split('T')[0];
};


// --- COMPONENTE PRINCIPAL (MANAGER) ---
export default function ContratoManager({ initialContratoData, onUpdate }) {
    const supabase = createClient();
    const [contrato, setContrato] = useState(initialContratoData);
    const [plano, setPlano] = useState(initialContratoData.plano_pagamento || {});
    const [parcelas, setParcelas] = useState(initialContratoData.contrato_parcelas || []);
    const [permutas, setPermutas] = useState(initialContratoData.contrato_permutas || []);
    
    const [newParcela, setNewParcela] = useState({ descricao: '', tipo: 'Adicional', data_vencimento: '', valor_parcela: '' });
    const [newPermuta, setNewPermuta] = useState({ descricao: '', valor: '' });
    
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingData, setEditingData] = useState({});
    
    const [loading, setLoading] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    // Valor base para todos os cálculos, pegando do contrato ou do produto.
    const baseValue = useMemo(() => 
        contrato.valor_final_venda || initialContratoData?.produto?.valor_venda_calculado || 0,
        [contrato.valor_final_venda, initialContratoData?.produto?.valor_venda_calculado]
    );

    useEffect(() => {
        setContrato(initialContratoData);
        const initialPlano = initialContratoData.plano_pagamento || {};
        
        setPlano(initialPlano);
        setParcelas(initialContratoData.contrato_parcelas || []);
        setPermutas(initialContratoData.contrato_permutas || []);
    }, [initialContratoData]);
    
    const totalParcelado = useMemo(() => parcelas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0), [parcelas]);
    
    const valorComDesconto = useMemo(() => baseValue - (plano.desconto_valor || 0), [baseValue, plano.desconto_valor]);
    
    const diferenca = valorComDesconto - totalParcelado;

    const handlePlanoChange = (name, value) => {
        const newPlanoState = { ...plano };

        if (name.includes('_percentual')) {
            const numericValue = parseFloat(value) || 0;
            const valueFieldName = name.replace('_percentual', '_valor');
            
            newPlanoState[name] = value; 
            const calculatedValue = (numericValue / 100) * baseValue;
            newPlanoState[valueFieldName] = calculatedValue;

        } else if (name.includes('_valor')) {
            const numericValue = value || 0;
            const percentFieldName = name.replace('_valor', '_percentual');

            newPlanoState[name] = numericValue;
            
            if (baseValue > 0) {
                const calculatedPercent = (numericValue / baseValue) * 100;
                newPlanoState[percentFieldName] = parseFloat(calculatedPercent.toFixed(4));
            } else {
                newPlanoState[percentFieldName] = 0;
            }
        } else {
            newPlanoState[name] = value;
        }

        setPlano(newPlanoState);
    };

    const handleSaveAndRecalculatePlano = async () => {
        if (!window.confirm("Isso irá apagar o cronograma atual e gerar um novo com base nos parâmetros do formulário. Deseja continuar?")) {
            return;
        }
        setLoading(true);
        const updatedContratoData = {
            plano_pagamento: plano,
            valor_final_venda: contrato.valor_final_venda || baseValue
        };

        const { error: updateError } = await supabase.from('contratos').update(updatedContratoData).eq('id', contrato.id);
        
        if (updateError) {
            toast.error("Erro ao salvar o plano: " + updateError.message);
            setLoading(false);
            return;
        }
        const { error: rpcError } = await supabase.rpc('regerar_parcelas_contrato', { p_contrato_id: contrato.id });
        if (rpcError) {
            toast.error("Erro ao recalcular as parcelas: " + rpcError.message);
        } else {
            toast.success("Cronograma recalculado com sucesso!");
            onUpdate();
        }
        setLoading(false);
    };

    const handleAddParcela = async () => { /* ...código sem alteração... */ };
    const handleDeleteParcela = async (parcelaId) => { /* ...código sem alteração... */ };
    const handleStartEditing = (parcela) => { setEditingRowId(parcela.id); setEditingData(parcela); };
    const handleCancelEditing = () => { setEditingRowId(null); setEditingData({}); };
    const handleSaveEditing = async (parcelaId) => { /* ...código sem alteração... */ };
    const handleAddPermuta = async () => { /* ...código sem alteração... */ };
    const handleDeletePermuta = async (id) => { /* ...código sem alteração... */ };
    const handleStatusChange = async (e) => { /* ...código sem alteração... */ };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Contrato #{contrato.id}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-bold text-gray-600 flex items-center gap-2 mb-2"><FontAwesomeIcon icon={faIdCard} /> CLIENTE</h4>
                        <p className="font-semibold text-gray-800">{contrato.contato.nome || contrato.contato.razao_social}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-bold text-gray-600 flex items-center gap-2 mb-2"><FontAwesomeIcon icon={faFileSignature} /> PRODUTO</h4>
                        <p className="font-semibold text-gray-800">Unidade {contrato.produto.unidade} ({contrato.produto.tipo})</p>
                        <p className="font-bold text-blue-600 text-lg">{formatCurrency(baseValue)}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Status do Contrato</label>
                        <select value={contrato.status_contrato} onChange={handleStatusChange} className="mt-1 w-full p-2 border rounded-md">
                            <option>Em assinatura</option><option>Ativo</option><option>Quitado</option><option>Cancelado</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">Plano de Pagamento</h3>
                    <button onClick={handleSaveAndRecalculatePlano} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                        <FontAwesomeIcon icon={loading ? faSpinner : faSave} spin={loading} /> Salvar e Recalcular Cronograma
                    </button>
                </div>
                <div className="space-y-4 pt-4 border-t">
                    {/* Desconto */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Desconto (%)</label>
                            <input type="number" step="0.01" name="desconto_percentual" value={plano.desconto_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Desconto (R$)</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { 
                                    mask: Number,
                                    scale: 2, 
                                    padFractionalZeros: true, 
                                    radix: ',',
                                    mapToRadix: ['.'] 
                                }}}
                                name="desconto_valor"
                                value={String(plano.desconto_valor || '')}
                                onAccept={(value, mask) => handlePlanoChange('desconto_valor', mask.number)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>
                    {/* Entrada */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium">Entrada (%)</label>
                            <input type="number" step="0.01" name="entrada_percentual" value={plano.entrada_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Entrada (R$)</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { 
                                    mask: Number,
                                    scale: 2, 
                                    padFractionalZeros: true, 
                                    radix: ',',
                                    mapToRadix: ['.'] 
                                }}}
                                name="entrada_valor"
                                value={String(plano.entrada_valor || '')}
                                onAccept={(value, mask) => handlePlanoChange('entrada_valor', mask.number)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_entrada" value={plano.num_parcelas_entrada || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_entrada" value={formatDateForInput(plano.data_primeira_parcela_entrada)} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                    {/* Obra */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium">Obra (%)</label>
                            <input type="number" step="0.01" name="parcelas_obra_percentual" value={plano.parcelas_obra_percentual || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Obra (R$)</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { 
                                    mask: Number,
                                    scale: 2, 
                                    padFractionalZeros: true, 
                                    radix: ',',
                                    mapToRadix: ['.'] 
                                }}}
                                name="parcelas_obra_valor"
                                value={String(plano.parcelas_obra_valor || '')}
                                onAccept={(value, mask) => handlePlanoChange('parcelas_obra_valor', mask.number)}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        <div><label className="block text-sm font-medium">Nº Parcelas</label><input type="number" name="num_parcelas_obra" value={plano.num_parcelas_obra || ''} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Data 1ª Parcela</label><input type="date" name="data_primeira_parcela_obra" value={formatDateForInput(plano.data_primeira_parcela_obra)} onChange={e => handlePlanoChange(e.target.name, e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                </div>
            </div>
            
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 space-y-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faSyncAlt} className="text-orange-500" /> Itens Recebidos em Permuta</h3>
                <div className="space-y-2">{permutas.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-2 rounded border"><span className="font-medium text-sm">{item.descricao}</span><div className="flex items-center gap-4"><span className="font-bold text-sm">{formatCurrency(item.valor)}</span><button onClick={() => handleDeletePermuta(item.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button></div></div>))}</div>
                <div className="flex items-end gap-3 pt-4 border-t">
                    <div className="flex-grow"><label className="text-xs font-medium">Descrição</label><input type="text" value={newPermuta.descricao} onChange={(e) => setNewPermuta(p => ({...p, descricao: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="Ex: Lote Bairro X" /></div>
                    <div className="w-48"><label className="text-xs font-medium">Valor (R$)</label><input type="text" value={newPermuta.valor} onChange={(e) => setNewPermuta(p => ({...p, valor: e.target.value}))} className="w-full p-2 border rounded-md" placeholder="150.000,00" /></div>
                    <button onClick={handleAddPermuta} disabled={loading} className="bg-orange-500 text-white px-4 py-2 rounded-md h-fit"><FontAwesomeIcon icon={loading ? faSpinner : faPlus} spin={loading}/> Adicionar</button>
                </div>
            </div>
            
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
                                <tr key={p.id} className="bg-yellow-50">
                                    <td className="p-2"><input type="text" value={editingData.descricao} onChange={e => setEditingData({...editingData, descricao: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="text" value={editingData.tipo} onChange={e => setEditingData({...editingData, tipo: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="date" value={formatDateForInput(editingData.data_vencimento)} onChange={e => setEditingData({...editingData, data_vencimento: e.target.value})} className="w-full p-1 border rounded" /></td>
                                    <td className="p-2"><input type="number" step="0.01" value={editingData.valor_parcela} onChange={e => setEditingData({...editingData, valor_parcela: e.target.value})} className="w-full p-1 border rounded text-right" /></td>
                                    <td className="p-2 text-center">
                                        <select value={editingData.status_pagamento} onChange={e => setEditingData({...editingData, status_pagamento: e.target.value})} className="w-full p-1 border rounded">
                                            <option>Pendente</option> <option>Pago</option>
                                        </select>
                                    </td>
                                    <td className="p-2 text-center space-x-2">
                                        <button onClick={() => handleSaveEditing(p.id)} className="text-green-600" disabled={loading}><FontAwesomeIcon icon={loading ? faSpinner : faSave} spin={loading} /></button>
                                        <button onClick={handleCancelEditing} className="text-gray-600"><FontAwesomeIcon icon={faTimes} /></button>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={p.id}>
                                    <td className="px-4 py-2">{p.descricao}</td>
                                    <td className="px-4 py-2">{p.tipo}</td>
                                    <td className="px-4 py-2">{formatDateForDisplay(p.data_vencimento)}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.valor_parcela)}</td>
                                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 text-xs rounded-full ${p.status_pagamento === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status_pagamento}</span></td>
                                    <td className="px-4 py-2 text-center space-x-2">
                                        <button onClick={() => handleStartEditing(p)} className="text-blue-600"><FontAwesomeIcon icon={faPen} /></button>
                                        <button onClick={() => handleDeleteParcela(p.id)} className="text-red-500" disabled={loading}><FontAwesomeIcon icon={faTrash} /></button>
                                    </td>
                                </tr>
                            )
                        ))}
                        <tr className="bg-gray-50">
                            <td className="p-2"><input type="text" placeholder="Descrição da parcela avulsa" value={newParcela.descricao} onChange={e => setNewParcela({...newParcela, descricao: e.target.value})} className="w-full p-1 border rounded"/></td>
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
                        <tr><td colSpan="3" className="px-4 py-2 text-right">VALOR COM DESCONTO:</td><td colSpan="3" className="px-4 py-2 text-left">{formatCurrency(valorComDesconto)}</td></tr>
                        <tr><td colSpan="3" className="px-4 py-2 text-right">TOTAL PARCELADO:</td><td colSpan="3" className="px-4 py-2 text-left">{formatCurrency(totalParcelado)}</td></tr>
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

            <ContratoAnexos contratoId={contrato.id} onUpdate={onUpdate} />
        </div>
    );
}
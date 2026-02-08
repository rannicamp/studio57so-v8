// components/financeiro/LancamentosManager.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faTimes, faPenToSquare, faTrash, faSort, faSortUp, faSortDown, faLayerGroup, 
    faChevronLeft, faChevronRight, faRobot, faCheckCircle, faDollarSign, 
    faExchangeAlt, faCopy, faReceipt, faLink, faArrowUp, faArrowDown, faBalanceScale, faChevronDown,
    faHistory, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import ReciboModal from './ReciboModal';
import { toast } from 'sonner';

// ... (Manter HighlightedText e SortableHeader iguais) ...
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const SortableHeader = ({ label, sortKey, sortConfig, requestSort, className = '' }) => {
    const getIcon = () => { if (sortConfig.key !== sortKey) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; };
    return ( <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 hover:text-gray-900"><span className="uppercase">{label}</span><FontAwesomeIcon icon={getIcon()} className="text-gray-400" /></button></th> );
};

const AnalysisModal = ({ isOpen, onClose, analysisText, isLoading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><FontAwesomeIcon icon={faRobot} />Análise Financeira do Gemini</h3><button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button></div>
                <div className="max-h-[60vh] overflow-y-auto p-4 bg-gray-50 rounded-md border">{isLoading ? (<div className="text-center"><FontAwesomeIcon icon={faSpinner} spin size="2x" /><p className="mt-2">Analisando dados...</p></div>) : (<div className="prose prose-sm max-w-none whitespace-pre-wrap">{analysisText}</div>)}</div>
                <div className="flex justify-end pt-4 mt-4 border-t"><button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Fechar</button></div>
            </div>
        </div>
    );
};

const BatchUpdateModal = ({ isOpen, onClose, onConfirm, fields, allData }) => {
    const [selectedField, setSelectedField] = useState(''); const [selectedValue, setSelectedValue] = useState(''); if (!isOpen) return null; const currentField = fields.find(f => f.key === selectedField);
    return ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg"> <h3 className="text-xl font-bold mb-4">Alterar Campo em Lote</h3> <div className="space-y-4"> <div> <label className="block text-sm font-medium">1. Campo para alterar</label> <select value={selectedField} onChange={(e) => { setSelectedField(e.target.value); setSelectedValue(''); }} className="mt-1 w-full p-2 border rounded-md"> <option value="">Selecione um campo...</option> {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)} </select> </div> {selectedField && currentField && ( <div> <label className="block text-sm font-medium">2. Novo valor para &quot;{currentField.label}&quot;</label> {currentField.type === 'select' ? ( <select value={selectedValue} onChange={(e) => setSelectedValue(e.target.value)} className="mt-1 w-full p-2 border rounded-md"> <option value="">Selecione um valor...</option> {allData[currentField.optionsKey]?.map(opt => <option key={opt.id} value={opt.id}>{opt.nome || opt.razao_social || opt.nome_etapa || opt.full_name}</option>)} </select> ) : ( <input type={currentField.type || 'text'} value={selectedValue} onChange={(e) => setSelectedValue(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /> )} </div> )} </div> <div className="flex justify-end gap-4 pt-6 mt-4 border-t"> <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-md">Cancelar</button> <button onClick={() => onConfirm(selectedField, selectedValue)} disabled={!selectedField || !selectedValue} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">Confirmar Alteração</button> </div> </div> </div> );
};

export default function LancamentosManager({
    lancamentos, allLancamentosKpi, loading, contas, categorias, empreendimentos, empresas, funcionarios, allContacts,
    onEdit, onUpdate, filters, setFilters, sortConfig, setSortConfig,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalCount,
    onRowClick, isCompetenciaMode 
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isBatchActionsOpen, setIsBatchActionsOpen] = useState(false);
    const [isBatchUpdateModalOpen, setIsBatchUpdateModalOpen] = useState(false);
    const batchActionsRef = useRef(null);
    const [itemsPerPageInput, setItemsPerPageInput] = useState(itemsPerPage);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [editingCell, setEditingCell] = useState(null);
    const [isReciboModalOpen, setIsReciboModalOpen] = useState(false);
    const [lancamentoParaRecibo, setLancamentoParaRecibo] = useState(null);

    const onActionSuccess = () => { queryClient.invalidateQueries({queryKey: ['lancamentos']}); if (onUpdate) onUpdate(); };

    const updateStatusMutation = useMutation({ mutationFn: async ({ lancamentoId, newStatus }) => { const updateData = { status: newStatus }; if (newStatus === 'Pago') { updateData.data_pagamento = new Date().toISOString(); } const { error } = await supabase.from('lancamentos').update(updateData).eq('id', lancamentoId); if (error) throw new Error(error.message); }, onSuccess: onActionSuccess });
    const duplicateMutation = useMutation({ mutationFn: async (item) => { const { id, created_at, conta, categoria, empreendimento, empresa, favorecido, anexos, ...lancamentoParaDuplicar } = item; lancamentoParaDuplicar.descricao = `(Cópia) ${lancamentoParaDuplicar.descricao}`; lancamentoParaDuplicar.status = 'Pendente'; lancamentoParaDuplicar.data_pagamento = null; lancamentoParaDuplicar.conciliado = false; const { error } = await supabase.from('lancamentos').insert([lancamentoParaDuplicar]); if (error) throw new Error(error.message); }, onSuccess: onActionSuccess });
    const deleteSingleMutation = useMutation({ mutationFn: async (id) => { const { error } = await supabase.from('lancamentos').delete().eq('id', id); if (error) throw error; }, onSuccess: () => { onActionSuccess(); }, onError: (error) => toast.error(`Erro: ${error.message}`) });
    const deleteFutureMutation = useMutation({ mutationFn: async ({ parcela_grupo, data_vencimento }) => { if (!user?.organizacao_id) throw new Error("Organização não identificada."); const { error } = await supabase.rpc('delete_lancamentos_futuros_do_grupo', { p_grupo_id: parcela_grupo, p_data_referencia: data_vencimento, p_organizacao_id: user.organizacao_id }); if (error) throw error; }, onSuccess: () => { onActionSuccess(); }, onError: (error) => toast.error(`Erro ao excluir futuros: ${error.message}`) });
    
    const DeletionToast = ({ toastId, onSingleDelete, onFutureDelete }) => ( <div className="w-full"> <p className="font-semibold">Este lançamento faz parte de uma série.</p> <p className="text-sm text-gray-600 mb-3">O que você gostaria de fazer?</p> <div className="flex gap-2"> <button onClick={() => { toast.dismiss(toastId); onSingleDelete(); }} className="w-full text-sm font-semibold px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"> Excluir somente este </button> <button onClick={() => { toast.dismiss(toastId); onFutureDelete(); }} className="w-full text-sm font-semibold px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"> Excluir este e os futuros </button> </div> </div> );
    const handleDelete = (item) => { if (!item.parcela_grupo) { toast("Excluir Lançamento", { description: `Tem certeza que deseja excluir "${item.descricao}"?`, action: { label: "Excluir", onClick: () => toast.promise(deleteSingleMutation.mutateAsync(item.id), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}`, }), }, cancel: { label: "Cancelar" }, }); return; } toast.custom((t) => ( <DeletionToast toastId={t} onSingleDelete={() => toast.promise(deleteSingleMutation.mutateAsync(item.id), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}`, })} onFutureDelete={() => toast.promise(deleteFutureMutation.mutateAsync(item), { loading: 'Excluindo lançamentos futuros...', success: 'Lançamentos futuros excluídos!', error: (err) => `Erro: ${err.message}`, })} /> ), { duration: 10000 }); };
    
    const bulkDeleteMutation = useMutation({ mutationFn: async (ids) => { const { error } = await supabase.from('lancamentos').delete().in('id', ids); if (error) throw new Error(error.message); return ids.length; }, onSuccess: () => { setSelectedIds(new Set()); onActionSuccess(); }, });
    const bulkUpdateMutation = useMutation({ mutationFn: async ({ ids, updateObject }) => { const { error } = await supabase.from('lancamentos').update(updateObject).in('id', ids); if (error) throw new Error(error.message); return ids.length; }, onSuccess: onActionSuccess, });
    
    const handleStatusUpdate = (lancamentoId, newStatus) => { setEditingCell(null); toast.promise(updateStatusMutation.mutateAsync({ lancamentoId, newStatus }), { loading: 'Atualizando status...', success: 'Status atualizado!', error: (err) => `Erro: ${err.message}`, }); };
    const handleDuplicate = (item) => { toast.promise( new Promise((resolve, reject) => { if (window.confirm(`Tem certeza que deseja duplicar o lançamento: "${item.descricao}"?`)) { duplicateMutation.mutateAsync(item).then(resolve).catch(reject); } else { reject('Ação cancelada pelo usuário.'); } }), { loading: 'Duplicando lançamento...', success: 'Lançamento duplicado com sucesso!', error: (err) => (err === 'Ação cancelada pelo usuário.' ? err : `Erro ao duplicar: ${err.message}`), }); };
    const handleBulkDelete = () => { if (selectedIds.size === 0) return; toast.promise( new Promise((resolve, reject) => { if (window.confirm(`Tem certeza que deseja EXCLUIR ${selectedIds.size} lançamento(s)? Esta ação não pode ser desfeita.`)) { bulkDeleteMutation.mutateAsync(Array.from(selectedIds)).then(resolve).catch(reject); } else { reject('Ação cancelada pelo usuário.'); } }), { loading: 'Excluindo lançamentos...', success: (count) => `${count} lançamento(s) excluído(s) com sucesso!`, error: (err) => (err === 'Ação cancelada pelo usuário.' ? err : `Erro ao excluir: ${err.message}`), }); setIsBatchActionsOpen(false); };
    const handleBatchUpdateField = (field, value) => { setIsBatchUpdateModalOpen(false); if(!field || !value) { toast.warning("Por favor, selecione um campo e um valor."); return; } const updateObject = { [field]: value }; if(field === 'status' && value === 'Pago'){ updateObject.data_pagamento = new Date().toISOString(); } toast.promise( new Promise((resolve, reject) => { if (window.confirm(`Tem certeza que deseja aplicar esta alteração a ${selectedIds.size} lançamento(s)?`)) { bulkUpdateMutation.mutateAsync({ ids: Array.from(selectedIds), updateObject }).then(resolve).catch(reject); } else { reject('Ação cancelada pelo usuário.'); } }), { loading: 'Atualizando lançamentos em lote...', success: (count) => `${count} lançamento(s) atualizado(s) com sucesso!`, error: (err) => (err === 'Ação cancelada pelo usuário.' ? err : `Erro ao atualizar: ${err.message}`), }); };
    const handleOpenRecibo = (lancamento) => { setLancamentoParaRecibo(lancamento); setIsReciboModalOpen(true); };

    const handleItemsPerPageChange = () => { let value = Number(itemsPerPageInput); if (isNaN(value) || value < 1) value = 1; if (value > 999) value = 999; setItemsPerPageInput(value); setItemsPerPage(value); setCurrentPage(1); };
    useEffect(() => { setSelectedIds(new Set()); }, [lancamentos]);
    
    useEffect(() => {
        function handleClickOutside(event) { if (batchActionsRef.current && !batchActionsRef.current.contains(event.target)) { setIsBatchActionsOpen(false); } }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [batchActionsRef]);

    const requestSort = (key) => { let direction = 'descending'; if (sortConfig.key === key && sortConfig.direction === 'descending') direction = 'ascending'; setSortConfig({ key, direction }); setCurrentPage(1); };
    const handleSelectAll = (e) => setSelectedIds(e.target.checked ? new Set(lancamentos.map(l => l.id)) : new Set());
    const handleSelectOne = (id) => { const newSelection = new Set(selectedIds); if (newSelection.has(id)) newSelection.delete(id); else newSelection.add(id); setSelectedIds(newSelection); };
    
    const batchUpdateFields = [ { key: 'status', label: 'Status', type: 'select', optionsKey: 'statusOptions' }, { key: 'favorecido_contato_id', label: 'Favorecido (Contato)', type: 'select', optionsKey: 'contatos' }, { key: 'funcionario_id', label: 'Associar ao Funcionário', type: 'select', optionsKey: 'funcionarios' }, { key: 'categoria_id', label: 'Categoria', type: 'select', optionsKey: 'categorias' }, { key: 'empreendimento_id', label: 'Empreendimento', type: 'select', optionsKey: 'empreendimentos' }, { key: 'conta_id', label: 'Conta', type: 'select', optionsKey: 'contas' }, { key: 'etapa_id', label: 'Etapa da Obra', type: 'select', optionsKey: 'etapas' }, { key: 'data_vencimento', label: 'Data de Vencimento', type: 'date' }, ];
    const allDataForBatchModal = { statusOptions: [{id: 'Pago', nome: 'Pago'}, {id: 'Pendente', nome: 'Pendente'}], categorias, empreendimentos, contas, etapas: [], contatos: allContacts, funcionarios: funcionarios?.map(f => ({ ...f, nome: f.full_name })), };

    const getPaymentStatus = (item) => {
        if (item.status === 'Pago' || item.status === 'Conciliado' || item.conciliado) return { text: 'Paga', className: 'bg-green-100 text-green-800' };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date((item.data_vencimento || item.data_transacao) + 'T00:00:00Z');
        if (dueDate < today) return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
        return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
    };

    const formatCurrency = (value, tipo) => { const signal = tipo === 'Receita' ? '+' : (tipo === 'Despesa' ? '-' : ''); return `${signal} ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value || 0))}`; };
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return (
        <div className="space-y-4">
            <AnalysisModal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} analysisText={analysisResult} isLoading={isAnalyzing} />
            <BatchUpdateModal isOpen={isBatchUpdateModalOpen} onClose={() => setIsBatchUpdateModalOpen(false)} onConfirm={handleBatchUpdateField} fields={batchUpdateFields} allData={allDataForBatchModal} />
            <ReciboModal isOpen={isReciboModalOpen} onClose={() => setIsReciboModalOpen(false)} lancamento={lancamentoParaRecibo} />
            
            <div className="flex justify-between items-center bg-white p-4 border rounded-lg shadow-sm">
                <span className="text-sm text-gray-700"> Mostrando <strong>{lancamentos.length}</strong> de <strong>{totalCount}</strong> lançamentos </span>
                <div className="flex items-center gap-2">
                    <label htmlFor="items-per-page" className="text-sm font-medium">Itens por página:</label>
                    <input type="number" id="items-per-page" value={itemsPerPageInput} onChange={(e) => setItemsPerPageInput(e.target.value)} onBlur={handleItemsPerPageChange} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }} min="1" max="999" className="w-20 p-2 border rounded-md text-center" />
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || loading} className="p-2 border rounded-md disabled:opacity-50"> <FontAwesomeIcon icon={faChevronLeft} /> </button>
                    <span className="px-4 py-2 text-sm">Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading} className="p-2 border rounded-md disabled:opacity-50"> <FontAwesomeIcon icon={faChevronRight} /> </button>
                </div>
            </div>

            {selectedIds.size > 0 && ( 
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between animate-fade-in"> 
                    <span className="text-sm font-semibold text-blue-800 uppercase">{selectedIds.size} selecionado(s)</span> 
                    <div className="relative" ref={batchActionsRef}> 
                        <button onClick={() => setIsBatchActionsOpen(prev => !prev)} className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm font-bold hover:bg-blue-700 uppercase flex items-center gap-2"> 
                            <FontAwesomeIcon icon={faLayerGroup} /> Ações em Lote <FontAwesomeIcon icon={faChevronDown} className="text-xs"/> 
                        </button> 
                        {isBatchActionsOpen && ( 
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border"> 
                                <a onClick={() => { setIsBatchUpdateModalOpen(true); setIsBatchActionsOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Alterar Campo...</a> 
                                <a onClick={() => { handleBulkDelete(); setIsBatchActionsOpen(false); }} className="block px-4 py-2 text-sm text-red-700 hover:bg-red-50 cursor-pointer">Excluir Selecionados</a>
                            </div> 
                        )} 
                    </div> 
                </div> 
            )}
            
            {loading ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) : (
                 <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                           <thead className="bg-gray-50">
                               <tr>
                                    <th className="p-4 w-4"><input type="checkbox" onChange={handleSelectAll} checked={lancamentos.length > 0 && selectedIds.size === lancamentos.length} /></th>
                                    
                                    <SortableHeader 
                                        label={isCompetenciaMode ? "Data (Comp.)" : "Data (Caixa)"} 
                                        sortKey={isCompetenciaMode ? "data_transacao" : "data_vencimento"} 
                                        sortConfig={sortConfig} 
                                        requestSort={requestSort} 
                                        className={isCompetenciaMode ? "text-purple-700 bg-purple-50" : ""}
                                    />
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase w-1/3">Descrição</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Favorecido</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Conta</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Empresa</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Categoria</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Conc.</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-gray-200">
                                {lancamentos.length > 0 ? lancamentos.map(item => {
                                    const statusInfo = getPaymentStatus(item);
                                    const isPending = item.status === 'Pendente' && !item.conciliado;
                                    const isTransfer = !!item.transferencia_id;
                                    const isDivergent = item.status_auditoria_ia === 'Divergente' || item.status_auditoria_ia === 'Erro';
                                    const nomeEmpresa = item.conta?.empresa?.nome_fantasia || item.conta?.empresa?.razao_social || 'N/A';
                                    const nomeFavorecido = item.favorecido?.nome || item.favorecido?.razao_social || '-';
                                    
                                    // --- LÓGICA DE EXIBIÇÃO DE DATA ---
                                    let displayDate;
                                    let dateLabel;
                                    let dateClass = '';

                                    if (isCompetenciaMode) {
                                        displayDate = item.data_transacao;
                                        dateLabel = 'Data de Competência (Transação)';
                                        dateClass = 'text-gray-700'; 
                                    } else {
                                        if (item.data_pagamento) {
                                            displayDate = item.data_pagamento;
                                            dateLabel = 'Data do Pagamento';
                                        } else if (item.data_vencimento) {
                                            displayDate = item.data_vencimento;
                                            dateLabel = 'Data de Vencimento';
                                            if (statusInfo.text === 'Atrasada') dateClass = 'text-red-600 font-bold';
                                        } else {
                                            displayDate = item.data_transacao;
                                            dateLabel = 'Data da Transação (Sem vencimento)';
                                        }
                                    }
                                    
                                    const formattedDescription = item.descricao.replace(/\s\((\d+)\/\d+\)$/, ' #$1');

                                    return (
                                        <tr key={item.id} onClick={() => onRowClick(item)} 
                                            className={`cursor-pointer border-b transition-colors 
                                                ${selectedIds.has(item.id) ? 'bg-blue-100' : 
                                                  isDivergent ? 'bg-orange-100 hover:bg-orange-200' : 
                                                  isTransfer ? 'bg-yellow-50 hover:bg-yellow-100' : 
                                                  'hover:bg-gray-50'
                                                }`}
                                        >
                                             <td className="p-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleSelectOne(item.id)} /></td>
                                             
                                             <td className={`px-4 py-2 whitespace-nowrap ${dateClass}`} title={dateLabel}>
                                                 {formatDate(displayDate)}
                                                 {isCompetenciaMode && <span className="ml-1 text-[10px] text-gray-400 block">Comp.</span>}
                                             </td>

                                             <td className="px-4 py-2 font-medium flex items-center gap-2">
                                                 {isDivergent && <FontAwesomeIcon icon={faExclamationTriangle} className="text-orange-600" title="Divergência na Auditoria IA" />}
                                                 {item.parcela_grupo && <FontAwesomeIcon icon={faLink} className="text-gray-400" title="Este lançamento faz parte de uma série" />}
                                                 {item.transferencia_id && <FontAwesomeIcon icon={faExchangeAlt} className="text-gray-400" title="Transferência" />}
                                                 <span>{formattedDescription}</span>
                                             </td>
                                             <td className="px-4 py-2 text-gray-600 truncate max-w-[150px]" title={nomeFavorecido}>{nomeFavorecido}</td>
                                             <td className="px-4 py-2 text-gray-600">{item.conta?.nome || 'N/A'}</td>
                                             <td className="px-4 py-2 text-gray-600 uppercase">{nomeEmpresa}</td>
                                             <td className="px-4 py-2 text-gray-600">{item.categoria?.nome || 'N/A'}</td>
                                             <td className="px-4 py-2 text-center text-green-500">{item.conciliado && <FontAwesomeIcon icon={faCheckCircle} title="Conciliado com o extrato bancário" />}</td>
                                             <td className={`px-4 py-2 text-right font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor, item.tipo)}</td>
                                             <td className="px-4 py-2 text-center text-xs">
                                                 {editingCell === item.id ? (
                                                     <select value={item.status} onChange={(e) => handleStatusUpdate(item.id, e.target.value)} onBlur={() => setEditingCell(null)} className="p-1 border rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500" autoFocus>
                                                          <option value="Pendente">Pendente</option>
                                                          <option value="Pago">Pago</option>
                                                     </select>
                                                 ) : (
                                                     <span onClick={(e) => { e.stopPropagation(); setEditingCell(item.id); }} className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className} cursor-pointer hover:ring-2 hover:ring-blue-300`}>
                                                          {statusInfo.text.toUpperCase()}
                                                     </span>
                                                 )}
                                             </td>
                                             <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                 <div className="flex items-center justify-center gap-3">
                                                     {(item.status === 'Pago' || item.status === 'Pendente') && !isTransfer && <button onClick={() => handleOpenRecibo(item)} className="text-purple-500 hover:text-purple-700" title="Gerar Recibo"><FontAwesomeIcon icon={faReceipt} /></button>}
                                                     {isPending && <button onClick={() => handleStatusUpdate(item.id, 'Pago')} className="text-green-500 hover:text-green-700" title="Marcar como Pago"><FontAwesomeIcon icon={faDollarSign} /></button>}
                                                     <button onClick={() => onEdit(item)} className="text-blue-500 hover:text-blue-700" title="Editar Completo"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                                     <button onClick={() => handleDuplicate(item)} className="text-gray-500 hover:text-gray-700" title="Duplicar Lançamento"><FontAwesomeIcon icon={faCopy} /></button>
                                                     <button onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                                 </div>
                                             </td>
                                     </tr>
                                    );
                                }) : (
                                     <tr><td colSpan="11" className="text-center py-10 text-gray-500 uppercase">Nenhum lançamento encontrado. Tente limpar os filtros.</td></tr>
                                )}
                           </tbody>
                      </table>
                 </div>
            )}
        </div>
    );
}
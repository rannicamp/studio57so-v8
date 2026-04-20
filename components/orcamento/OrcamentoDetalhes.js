"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faArrowLeft, faPen, faTrash, faGripVertical, faCubes } from '@fortawesome/free-solid-svg-icons';
import OrcamentoItemModal from './OrcamentoItemModal';
import BimImportModal from './BimImportModal';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

// Badge visual de origem do item
const BadgeOrigem = ({ origem }) => {
 const config = {
 bim: { label: '🏗️ BIM', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
 sinapi: { label: '📋 SINAPI', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
 material_proprio: { label: '🏢 Material', cls: 'bg-green-50 text-green-700 border border-green-200' },
 manual: { label: '✏️ Manual', cls: 'bg-gray-50 text-gray-600 border border-gray-200' },
 };
 const c = config[origem] || config['manual'];
 return (
 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase whitespace-nowrap ${c.cls}`}>
 {c.label}
 </span>
 );
};

export default function OrcamentoDetalhes({ orcamento, onBack }) {
 const supabase = createClient();
 const [itens, setItens] = useState([]);
 const [etapas, setEtapas] = useState([]);
 const [loading, setLoading] = useState(true);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingItem, setEditingItem] = useState(null);
 const [draggedItem, setDraggedItem] = useState(null);
 const [isBimModalOpen, setIsBimModalOpen] = useState(false);
 const [execucao, setExecucao] = useState(orcamento?.execucao_fisica || {});

 const handleExecucaoChange = (etapaId, val) => {
   let num = parseInt(val.replace(/\D/g, ''), 10);
   if (isNaN(num)) num = 0;
   if (num > 100) num = 100;
   setExecucao(prev => ({ ...prev, [etapaId]: num }));
 };

 const handleExecucaoBlur = async () => {
   if (!orcamento?.id || !organizacaoId) return;
   const { error } = await supabase
     .from('orcamentos')
     .update({ execucao_fisica: execucao })
     .eq('id', orcamento.id)
     .eq('organizacao_id', organizacaoId);
   if (error) {
     toast.error('Erro ao salvar % de execução da etapa.');
   } else {
     toast.success('Progresso físico atualizado.', { duration: 1500 });
   }
 };

 const organizacaoId = orcamento?.organizacao_id;
 const empreendimentoId = orcamento?.empreendimento_id;

 // Verifica se o empreendimento tem modelos BIM associados
 const { data: temModelosBim } = useQuery({
 queryKey: ['temModelosBim', empreendimentoId, organizacaoId],
 queryFn: async () => {
 if (!empreendimentoId || !organizacaoId) return false;
 const { count } = await supabase
 .from('projetos_bim')
 .select('id', { count: 'exact', head: true })
 .eq('empreendimento_id', empreendimentoId)
 .eq('organizacao_id', organizacaoId)
 .eq('is_lixeira', false);
 return (count || 0) > 0;
 },
 enabled: !!empreendimentoId && !!organizacaoId,
 staleTime: 5 * 60 * 1000,
 });

 const fetchItens = useCallback(async () => {
 if (!orcamento?.id || !organizacaoId) return;
 setLoading(true);
 const { data, error } = await supabase
 .from('orcamento_itens')
 .select('*, etapa:etapa_id(*), subetapa:subetapa_id(*)')
 .eq('orcamento_id', orcamento.id)
 .eq('organizacao_id', organizacaoId)
 .order('ordem', { ascending: true, nullsFirst: true });

 if (error) {
 console.error("Erro:", error);
 toast.error('Não foi possível carregar os itens do orçamento.');
 } else {
 setItens((data || []).map((item, index) => ({ ...item, ordem: item.ordem ?? index })));
 }
 setLoading(false);
 }, [supabase, orcamento, organizacaoId]);

 const fetchEtapas = useCallback(async () => {
 if (!organizacaoId) return;
 const { data } = await supabase
 .from('etapa_obra')
 .select('id, nome_etapa, codigo_etapa')
 .eq('organizacao_id', organizacaoId)
 .order('codigo_etapa');
 setEtapas(data || []);
 }, [supabase, organizacaoId]);

 useEffect(() => { fetchItens(); fetchEtapas(); }, [fetchItens, fetchEtapas]);

 const custoTotal = useMemo(() => itens.reduce((acc, item) => acc + (item.custo_total || 0), 0), [itens]);

 const groupedItems = useMemo(() => {
 const groups = new Map();
 itens.forEach(item => {
 const etapa = item.etapa;
 const subetapa = item.subetapa;
 const etapaKey = etapa ? `${etapa.codigo_etapa || '99'}-${etapa.nome_etapa}` : '99-Sem Etapa Definida';
 const subetapaKey = subetapa ? `${subetapa.id}-${subetapa.nome_subetapa}` : '0-Itens sem Subetapa';

 if (!groups.has(etapaKey)) {
 groups.set(etapaKey, {
 id: etapa?.id || 'SEM_ETAPA',
 codigo: etapa?.codigo_etapa?.split('.')[0] || '99',
 nome: etapa?.nome_etapa || 'Sem Etapa Definida',
 total: 0,
 subgrupos: new Map()
 });
 }
 const etapaGroup = groups.get(etapaKey);
 if (!etapaGroup.subgrupos.has(subetapaKey)) {
 etapaGroup.subgrupos.set(subetapaKey, {
 nome: subetapa?.nome_subetapa || 'Itens sem Subetapa',
 isRealSubetapa: !!subetapa,
 total: 0,
 items: []
 });
 }
 const subetapaGroup = etapaGroup.subgrupos.get(subetapaKey);
 subetapaGroup.items.push(item);
 subetapaGroup.total += (item.custo_total || 0);
 etapaGroup.total += (item.custo_total || 0);
 });

 return Array.from(groups.entries()).map(([key, etapaData]) => ({
 key,
 ...etapaData,
 subgrupos: Array.from(etapaData.subgrupos.entries())
 .map(([subKey, subData]) => ({ key: subKey, ...subData }))
 .sort((a, b) => a.key.localeCompare(b.key))
 })).sort((a, b) => a.key.localeCompare(b.key));
 }, [itens]);

 const handleSaveItem = async (formData) => {
 if (!organizacaoId) {
 toast.error("Orçamento sem organização definida. Não é possível salvar.");
 return false;
 }

 const isEditing = Boolean(formData.id);
 let success = false;
 const promise = async () => {
 let materialId = formData.material_id;
 if (!materialId && formData.descricao && formData.origem !== 'sinapi' && formData.origem !== 'bim') {
 const { data: newMaterial, error: materialError } = await supabase.from('materiais').insert({
 descricao: formData.descricao,
 unidade_medida: formData.unidade,
 Grupo: formData.categoria,
 preco_unitario: formData.preco_unitario || null,
 Origem: 'Manual',
 organizacao_id: organizacaoId
 }).select('id').single();
 if (materialError) throw new Error(`Erro ao criar novo material: ${materialError.message}`);
 materialId = newMaterial.id;
 }

 const itemParaSalvar = {
 orcamento_id: orcamento.id,
 material_id: materialId,
 descricao: formData.descricao,
 unidade: formData.unidade,
 quantidade: formData.quantidade,
 preco_unitario: formData.preco_unitario || null,
 categoria: formData.categoria,
 etapa_id: formData.etapa_id || null,
 subetapa_id: formData.subetapa_id || null,
 organizacao_id: organizacaoId,
 origem: formData.origem || 'manual',
 bim_projeto_id: formData.bim_projeto_id || null,
 bim_elemento_ids: formData.bim_elemento_ids || null,
 };

 if (isEditing) {
 const { error } = await supabase.from('orcamento_itens').update(itemParaSalvar).eq('id', formData.id).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 } else {
 itemParaSalvar.ordem = itens.length;
 const { error } = await supabase.from('orcamento_itens').insert(itemParaSalvar);
 if (error) throw error;
 }
 };

 await toast.promise(promise(), {
 loading: 'Salvando item...',
 success: () => { fetchItens(); success = true; return `Item ${isEditing ? 'atualizado' : 'criado'} com sucesso!`; },
 error: (err) => err.message
 });
 return success;
 };

 const handleOpenModal = (item = null) => { setEditingItem(item); setIsModalOpen(true); };
 const handleCloseModal = () => { setEditingItem(null); setIsModalOpen(false); };

 const handleDeleteItem = async (itemId) => {
 const promise = async () => {
 if (!organizacaoId) throw new Error("Organização não identificada.");
 const { error } = await supabase.from('orcamento_itens').delete().eq('id', itemId).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 };
 toast.warning("Tem certeza que deseja excluir este item?", {
 action: {
 label: "Excluir",
 onClick: () => toast.promise(promise(), {
 loading: 'Excluindo item...',
 success: () => { fetchItens(); return 'Item excluído com sucesso!'; },
 error: (err) => `Erro: ${err.message}`
 })
 },
 cancel: { label: "Cancelar" }
 });
 };

 const handleDragStart = (e, item) => { setDraggedItem(item); };
 const handleDragOver = (e) => { e.preventDefault(); };
 const handleDrop = async (e, targetItem) => {
 if (!draggedItem || draggedItem.id === targetItem.id || draggedItem.etapa_id !== targetItem.etapa_id || draggedItem.subetapa_id !== targetItem.subetapa_id) {
 setDraggedItem(null); return;
 }
 const itemsRelevantes = itens.filter(i => i.etapa_id === draggedItem.etapa_id && i.subetapa_id === draggedItem.subetapa_id);
 const currentIndex = itemsRelevantes.findIndex(i => i.id === draggedItem.id);
 const targetIndex = itemsRelevantes.findIndex(i => i.id === targetItem.id);
 itemsRelevantes.splice(currentIndex, 1);
 itemsRelevantes.splice(targetIndex, 0, draggedItem);
 const outrosItens = itens.filter(i => !(i.etapa_id === draggedItem.etapa_id && i.subetapa_id === draggedItem.subetapa_id));
 const todosItensOrdenados = [...outrosItens, ...itemsRelevantes];
 setItens(todosItensOrdenados);
 const updates = todosItensOrdenados.map((item, index) => ({ id: item.id, ordem: index }));
 const { error } = await supabase.rpc('reordenar_orcamento_itens', { itens_para_atualizar: updates });
 if (error) { toast.error('Erro ao salvar a nova ordem.'); fetchItens(); }
 setDraggedItem(null);
 };

 const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
 const formatPercentage = (value) => { if (!custoTotal || custoTotal === 0) return '0.00%'; return `${((value / custoTotal) * 100).toFixed(2)}%`; };

 const patrimonioExecutado = useMemo(() => {
   return groupedItems.reduce((acc, g) => acc + (g.total * (execucao[g.id] || 0)) / 100, 0);
 }, [groupedItems, execucao]);

 const percentualTotalObra = custoTotal > 0 ? ((patrimonioExecutado / custoTotal) * 100) : 0;

 return (
 <>
 <OrcamentoItemModal
 isOpen={isModalOpen}
 onClose={handleCloseModal}
 onSave={handleSaveItem}
 orcamentoId={orcamento.id}
 itemToEdit={editingItem}
 etapas={etapas}
 organizacaoId={organizacaoId}
 empreendimentoId={empreendimentoId}
 />

 {isBimModalOpen && (
 <BimImportModal
 isOpen={isBimModalOpen}
 onClose={() => { setIsBimModalOpen(false); fetchItens(); }}
 empreendimentoId={empreendimentoId}
 orcamentoId={orcamento.id}
 organizacaoId={organizacaoId}
 etapas={etapas}
 />
 )}

 <div className="space-y-6">
 <div className="sticky top-16 z-20 bg-white py-4 flex justify-between items-center mb-4 border-b border-gray-200">
 <div>
 <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-2">
 <FontAwesomeIcon icon={faArrowLeft} /> Voltar para Orçamentos
 </button>
 <h2 className="text-2xl font-bold text-gray-900">{orcamento.nome_orcamento}</h2>
 <p className="text-sm text-gray-500">Versão {orcamento.versao} - Status: {orcamento.status}</p>
 </div>
 <div className="flex items-center gap-2">
 {/* Botão BIM — só exibe se houver modelos BIM para o empreendimento */}
 {temModelosBim && (
 <button
 onClick={() => setIsBimModalOpen(true)}
 className="bg-white border border-blue-300 text-blue-700 text-sm font-bold px-4 py-2 rounded-md shadow-sm flex items-center gap-2 hover:bg-blue-50 transition-colors"
 title="Importar quantitativos do modelo BIM"
 >
 <FontAwesomeIcon icon={faCubes} />
 Importar do BIM
 </button>
 )}
 <button
 onClick={() => handleOpenModal()}
 className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-md shadow-sm flex items-center gap-2 transition-colors"
 >
 <FontAwesomeIcon icon={faPlus} /> Adicionar Item
 </button>
 </div>
 </div>

 <div className="overflow-x-auto border rounded-lg">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-2 py-3 w-10"></th>
 <th className="px-2 py-3 text-left text-xs font-bold uppercase w-24">Item</th>
 <th className="px-6 py-3 text-left text-xs font-bold uppercase">Descrição</th>
 <th className="px-4 py-3 text-left text-xs font-bold uppercase">Origem</th>
 <th className="px-6 py-3 text-left text-xs font-bold uppercase">Un.</th>
 <th className="px-6 py-3 text-center text-xs font-bold uppercase">Qtd.</th>
 <th className="px-6 py-3 text-right text-xs font-bold uppercase">Preço Unit.</th>
 <th className="px-6 py-3 text-right text-xs font-bold uppercase">Custo Total</th>
 <th className="px-6 py-3 text-right text-xs font-bold uppercase">% do Total</th>
 <th className="px-6 py-3 text-center text-xs font-bold uppercase">% Executado</th>
 <th className="px-6 py-3 text-center text-xs font-bold uppercase">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {loading ? (
 <tr><td colSpan="11" className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
 ) : groupedItems.length === 0 ? (
 <tr><td colSpan="11" className="text-center py-10 text-gray-500">
 Nenhum item adicionado. Clique em "Adicionar Item" ou "Importar do BIM".
 </td></tr>
 ) : (
 groupedItems.map(group => {
 let runningIndex = 0;
 return (
 <Fragment key={group.key}>
 <tr className="bg-gray-200 font-bold">
 <td colSpan="7" className="px-6 py-3 border-t-4 border-gray-300">{group.codigo} - {group.nome}</td>
 <td className="px-6 py-3 text-right border-t-4 border-gray-300">{formatCurrency(group.total)}</td>
 <td className="px-6 py-3 text-right border-t-4 border-gray-300 text-blue-700">{formatPercentage(group.total)}</td>
 <td className="px-6 py-2 border-t-4 border-gray-300 text-center">
 <input type="text" className="w-16 text-center font-bold text-green-700 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" value={execucao[group.id] !== undefined ? execucao[group.id] + '%' : '0%'} onChange={(e) => handleExecucaoChange(group.id, e.target.value)} onBlur={handleExecucaoBlur} />
 </td>
 <td className="px-6 py-3 border-t-4 border-gray-300"></td>
 </tr>
 {group.subgrupos.map(subgroup => {
 if (subgroup.isRealSubetapa) {
 runningIndex++;
 const subetapaNumber = runningIndex;
 return (
 <Fragment key={subgroup.key}>
 <tr className="bg-gray-100 font-semibold">
 <td colSpan="7" className="pl-12 pr-6 py-2">{group.codigo}.{subetapaNumber} - {subgroup.nome}</td>
 <td className="px-6 py-2 text-right">{formatCurrency(subgroup.total)}</td>
 <td className="px-6 py-2 text-right text-blue-600">{formatPercentage(subgroup.total)}</td>
 <td></td>
 </tr>
 {subgroup.items.map((item, itemIndex) => (
 <tr key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item)} className="hover:bg-gray-50 cursor-grab group">
 <td className="px-2 py-4 text-center text-gray-400"><FontAwesomeIcon icon={faGripVertical} /></td>
 <td className="px-2 py-4 text-sm font-mono">{`${group.codigo}.${subetapaNumber}.${itemIndex + 1}`}</td>
 <td className="px-6 py-4 text-sm">{item.descricao}</td>
 <td className="px-4 py-4"><BadgeOrigem origem={item.origem} /></td>
 <td className="px-6 py-4 text-sm">{item.unidade}</td>
 <td className="px-6 py-4 text-sm text-center">{item.quantidade}</td>
 <td className="px-6 py-4 text-sm text-right">{formatCurrency(item.preco_unitario)}</td>
 <td className="px-6 py-4 text-sm text-right font-semibold">{formatCurrency(item.custo_total)}</td>
 <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td>
 <td className="px-6 py-4 text-sm text-center">-</td>
 <td className="px-6 py-4 text-sm text-center">
 <div className="flex items-center justify-center gap-3">
 <button onClick={() => handleOpenModal(item)} title="Editar" className="text-blue-500 hover:text-blue-700 transition-colors"><FontAwesomeIcon icon={faPen} /></button>
 <button onClick={() => handleDeleteItem(item.id)} title="Excluir" className="text-gray-500 hover:text-red-700 transition-colors"><FontAwesomeIcon icon={faTrash} /></button>
 </div>
 </td>
 </tr>
 ))}
 </Fragment>
 );
 } else {
 return (
 <Fragment key={subgroup.key}>
 {subgroup.items.map(item => {
 runningIndex++;
 return (
 <tr key={item.id} draggable onDragStart={(e) => handleDragStart(e, item)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, item)} className="hover:bg-gray-50 cursor-grab group">
 <td className="px-2 py-4 text-center text-gray-400"><FontAwesomeIcon icon={faGripVertical} /></td>
 <td className="px-2 py-4 text-sm font-mono">{`${group.codigo}.${runningIndex}`}</td>
 <td className="px-6 py-4 text-sm">{item.descricao}</td>
 <td className="px-4 py-4"><BadgeOrigem origem={item.origem} /></td>
 <td className="px-6 py-4 text-sm">{item.unidade}</td>
 <td className="px-6 py-4 text-sm text-center">{item.quantidade}</td>
 <td className="px-6 py-4 text-sm text-right">{formatCurrency(item.preco_unitario)}</td>
 <td className="px-6 py-4 text-sm text-right font-semibold">{formatCurrency(item.custo_total)}</td>
 <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">{formatPercentage(item.custo_total)}</td>
 <td></td>
 <td className="px-6 py-4 text-sm text-center">
 <div className="flex items-center justify-center gap-3">
 <button onClick={() => handleOpenModal(item)} title="Editar" className="text-blue-500 hover:text-blue-700 transition-colors"><FontAwesomeIcon icon={faPen} /></button>
 <button onClick={() => handleDeleteItem(item.id)} title="Excluir" className="text-gray-500 hover:text-red-700 transition-colors"><FontAwesomeIcon icon={faTrash} /></button>
 </div>
 </td>
 </tr>
 );
 })}
 </Fragment>
 );
 }
 })}
 </Fragment>
 );
 })
 )}
 </tbody>
 <tfoot className="bg-gray-100">
 <tr>
 <td colSpan="7" className="px-6 py-3 text-right text-sm font-bold uppercase text-gray-500 border-b border-gray-200">Custo Total Previsto (Alvo):</td>
 <td className="px-6 py-3 text-right text-base font-bold text-gray-700 border-b border-gray-200">{formatCurrency(custoTotal)}</td>
 <td className="px-6 py-3 text-right text-sm font-bold text-gray-400 border-b border-gray-200">100.00%</td>
 <td className="px-6 py-3 text-center text-sm font-bold text-gray-400 border-b border-gray-200">-</td>
 <td className="px-6 py-3 border-b border-gray-200"></td>
 </tr>
 <tr className="bg-blue-50">
 <td colSpan="7" className="px-6 py-4 text-right text-sm font-bold uppercase text-blue-800">Custo Total Executado (Realizado):</td>
 <td className="px-6 py-4 text-right text-base font-bold text-green-700">{formatCurrency(patrimonioExecutado)}</td>
 <td className="px-6 py-4 text-right text-sm font-bold text-gray-400">-</td>
 <td className="px-6 py-4 text-center text-lg font-bold text-blue-700">{percentualTotalObra.toFixed(2)}%</td>
 <td className="px-6 py-4"></td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 </>
 );
}
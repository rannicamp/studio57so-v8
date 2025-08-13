'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faPlus, faPencilAlt, faSave, faTimes, faClock, faPaperclip, faUpload, faDownload, faSort, faSortUp, faSortDown, faPen, faDollarSign, faBroom } from '@fortawesome/free-solid-svg-icons';
import PedidoItemModal from './PedidoItemModal';
import KpiCard from './KpiCard';

const formatDuration = (milliseconds) => {
    if (milliseconds < 0 || isNaN(milliseconds)) return '0 dias';
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h`;
    return result.trim() === '' ? 'Menos de 1h' : result;
};

const RegistrarPagamentoModal = ({ isOpen, onClose, onConfirm, contas }) => {
    const [contaId, setContaId] = useState('');
    const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold mb-4">Registrar Pagamento</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Conta de Pagamento *</label>
                        <select value={contaId} onChange={(e) => setContaId(e.target.value)} required className="mt-1 w-full p-2 border rounded-md">
                            <option value="">Selecione a conta...</option>
                            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Data do Pagamento *</label>
                        <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} required className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={() => onConfirm(contaId, dataPagamento)} disabled={!contaId || !dataPagamento} className="bg-green-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400">Confirmar Pagamento</button>
                </div>
            </div>
        </div>
    );
};


export default function PedidoForm({ pedidoId }) {
    const supabase = createClient();
    const router = useRouter();
    const [pedido, setPedido] = useState(null);
    const [itens, setItens] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [anexos, setAnexos] = useState([]);
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set()); 
    const [editingItem, setEditingItem] = useState(null);
    const [newAnexoFile, setNewAnexoFile] = useState(null);
    const [newAnexoType, setNewAnexoType] = useState('Nota Fiscal');
    const [newAnexoOutroDescricao, setNewAnexoOutroDescricao] = useState('');
    const [kpis, setKpis] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'descricao_item', direction: 'ascending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedItens = useMemo(() => {
        let sortableItems = [...itens];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                if (typeof valA === 'number' && typeof valB === 'number') { return sortConfig.direction === 'ascending' ? valA - valB : valB - valA; }
                if (valA < valB) { return sortConfig.direction === 'ascending' ? -1 : 1; }
                if (valA > valB) { return sortConfig.direction === 'ascending' ? 1 : -1; }
                return 0;
            });
        }
        return sortableItems;
    }, [itens, sortConfig]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos_compra').select(`*, solicitante:solicitante_id(nome), empreendimentos(nome), itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social, nome_fantasia), etapa:etapa_id(nome_etapa)), historico:pedidos_compra_status_historico(*), anexos:pedidos_compra_anexos(*)`).eq('id', pedidoId).single();
        if (pedidoError) { console.error(pedidoError); toast.error('Erro ao carregar os dados do pedido.'); setLoading(false); return; }
        setPedido(pedidoData); setItens(pedidoData.itens || []); setAnexos(pedidoData.anexos || []);
        if (pedidoData.historico) {
            const h = pedidoData.historico.sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca));
            const inicio = new Date(pedidoData.created_at);
            const cotacao = h.find(item => item.status_novo === 'Em Cotação')?.data_mudanca;
            const entrega = h.find(item => item.status_novo === 'Entregue')?.data_mudanca;
            setKpis({ tempoAteCotacao: cotacao ? formatDuration(new Date(cotacao) - inicio) : 'Pendente', tempoAteEntrega: entrega ? formatDuration(new Date(entrega) - inicio) : 'Pendente', });
        }
        const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa');
        setEtapas(etapasData || []);
        const { data: contasData } = await supabase.from('contas_financeiras').select('id, nome');
        setContas(contasData || []);
        setLoading(false);
    }, [pedidoId, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleHeaderFieldChange = (field, value) => { setPedido(p => ({ ...p, [field]: value })); };
    
    const handleHeaderFieldSave = async (field) => {
        toast.promise(
            supabase.from('pedidos_compra').update({ [field]: pedido[field] }).eq('id', pedidoId),
            {
                loading: 'Salvando...',
                success: () => { router.refresh(); return `${field.replace('_', ' ')} salvo com sucesso!`; },
                error: (err) => `Erro ao salvar: ${err.message}`,
            }
        );
    };
    
    const handleAddAnexo = async () => {
        if (!newAnexoFile) { toast.error('Por favor, selecione um arquivo.'); return; }
        setIsUploading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        const promise = new Promise(async (resolve, reject) => {
            const fileExtension = newAnexoFile.name.split('.').pop();
            const anexoDescricaoFinal = newAnexoType === 'Outro' ? newAnexoOutroDescricao : newAnexoType;
            const empreendimentoNome = pedido.empreendimentos.nome.replace(/ /g, '_');
            const fileName = `${anexoDescricaoFinal.replace(/ /g, '_')}_${empreendimentoNome}_Pedido#${pedido.id}_${Date.now()}.${fileExtension}`;
            
            const { error: uploadError } = await supabase.storage.from('pedidos-anexos').upload(fileName, newAnexoFile, { upsert: true });
            if (uploadError) return reject(uploadError);

            const { error: dbError } = await supabase.from('pedidos_compra_anexos').insert({ pedido_compra_id: pedido.id, caminho_arquivo: fileName, nome_arquivo: newAnexoFile.name, descricao: anexoDescricaoFinal, usuario_id: user.id });
            if (dbError) return reject(dbError);

            resolve("Anexo adicionado com sucesso!");
        });

        toast.promise(promise, {
            loading: 'Enviando anexo...',
            success: (msg) => {
                setNewAnexoFile(null); setNewAnexoType('Nota Fiscal'); setNewAnexoOutroDescricao(''); 
                if(document.getElementById('anexo-file-input')) document.getElementById('anexo-file-input').value = '';
                fetchData();
                return msg;
            },
            error: (err) => `Erro no upload: ${err.message}`,
            finally: () => setIsUploading(false)
        });
    };

    const handleRemoveAnexo = async (anexo) => {
        if (!window.confirm(`Tem certeza que deseja remover o anexo "${anexo.nome_arquivo}"?`)) return;
        
        toast.promise(
            new Promise(async (resolve, reject) => {
                await supabase.storage.from('pedidos-anexos').remove([anexo.caminho_arquivo]);
                const { error } = await supabase.from('pedidos_compra_anexos').delete().eq('id', anexo.id);
                if(error) return reject(error);
                resolve("Anexo removido!");
            }),
            {
                loading: 'Removendo anexo...',
                success: (msg) => { fetchData(); return msg; },
                error: (err) => `Erro ao remover: ${err.message}`,
            }
        );
    };

    const handleDownloadAnexo = async (caminho) => {
        const { data, error } = await supabase.storage.from('pedidos-anexos').createSignedUrl(caminho, 60);
        if (error) toast.error(`Erro ao gerar link de download: ${error.message}`); 
        else window.open(data.signedUrl, '_blank');
    };
    
    const handleSaveItem = async (itemData) => {
        const promise = new Promise(async (resolve, reject) => {
            const isEditing = Boolean(itemData.id);
            let finalMaterialId = itemData.material_id;

            if (!finalMaterialId && itemData.descricao_item) {
                const { data: newMaterial, error: materialError } = await supabase.from('materiais').insert({ descricao: itemData.descricao_item, unidade_medida: itemData.unidade_medida, Origem: 'Manual' }).select().single();
                if (materialError) return reject(new Error('Erro ao criar o novo material: ' + materialError.message));
                finalMaterialId = newMaterial.id;
            }

            const dataToUpsert = { 
                ...itemData, 
                material_id: finalMaterialId, 
                pedido_compra_id: pedidoId, 
                quantidade_solicitada: parseInt(itemData.quantidade_solicitada) || 0, 
                preco_unitario_real: itemData.preco_unitario_real === '' || itemData.preco_unitario_real === null ? null : parseFloat(itemData.preco_unitario_real),
                etapa_id: itemData.etapa_id === '' ? null : parseInt(itemData.etapa_id) || null,
                fornecedor_id: itemData.fornecedor_id === '' ? null : parseInt(itemData.fornecedor_id) || null,
            };
            
            // ***** INÍCIO DA CORREÇÃO *****
            if (itemData.tipo_operacao === 'Aluguel') {
                dataToUpsert.custo_total_real = 
                    (dataToUpsert.quantidade_solicitada || 0) * (dataToUpsert.preco_unitario_real || 0) * (parseInt(itemData.dias_aluguel) || 0); 
            } else {
                dataToUpsert.custo_total_real = (dataToUpsert.preco_unitario_real || 0) * (dataToUpsert.quantidade_solicitada || 0);
            }
            // ***** FIM DA CORREÇÃO *****
            
            delete dataToUpsert.fornecedor_nome;

            if(isEditing) {
                const { error } = await supabase.from('pedidos_compra_itens').update(dataToUpsert).eq('id', itemData.id);
                if(error) return reject(error);
            } else {
                delete dataToUpsert.id; 
                const { error } = await supabase.from('pedidos_compra_itens').insert(dataToUpsert);
                if(error) return reject(error);
            }
            resolve({ success: true, message: `Item ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!` });
        });

        toast.promise(promise, {
            loading: 'Salvando item...',
            success: (result) => { fetchData(); return result.message; },
            error: (err) => `Falha ao salvar o item: ${err.message}`,
        });
        
        // Retorna um booleano para o modal saber se deve fechar
        return promise.then(() => true).catch(() => false);
    };

    const handleRemoveItem = async (itemId) => {
        if (!window.confirm('Tem certeza que deseja remover este item?')) return;
        toast.promise(
            supabase.from('pedidos_compra_itens').delete().eq('id', itemId),
            {
                loading: 'Removendo item...',
                success: () => { setItens(prev => prev.filter(item => item.id !== itemId)); return "Item removido com sucesso!"; },
                error: (err) => `Erro ao remover item: ${err.message}`
            }
        );
    };

    // ***** INÍCIO DA NOVA FUNÇÃO *****
    const handleEmptyItemList = async () => {
        if (!window.confirm('ATENÇÃO: Tem certeza que deseja REMOVER TODOS OS ITENS deste pedido? Esta ação é irreversível!')) return;

        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error } = await supabase
                    .from('pedidos_compra_itens')
                    .delete()
                    .eq('pedido_compra_id', pedidoId);

                if (error) {
                    reject(new Error(`Erro ao esvaziar a lista: ${error.message}`));
                } else {
                    resolve('Lista de itens esvaziada com sucesso!');
                }
            }),
            {
                loading: 'Esvaziando lista de itens...',
                success: (msg) => { 
                    fetchData();
                    setSelectedItems(new Set());
                    return msg; 
                },
                error: (err) => err.message,
            }
        );
    };
    // ***** FIM DA NOVA FUNÇÃO *****

    const handleRegistrarPagamento = async (contaId, dataPagamento) => {
        setIsPagamentoModalOpen(false);
        setIsSaving(true);
        
        const promise = supabase.rpc('registrar_pagamento_pedido', {
            p_pedido_id: pedidoId,
            p_conta_id: contaId,
            p_data_pagamento: dataPagamento
        });

        toast.promise(promise, {
            loading: 'Registrando pagamento...',
            success: (response) => {
                if(response.error) throw new Error(response.error.message);
                fetchData();
                return response.data;
            },
            error: (err) => `Erro no registro: ${err.message}`,
            finally: () => setIsSaving(false)
        });
    };

    const handleSelectionChange = (itemId) => {
        setSelectedItems(prev => { const newSet = new Set(prev); if (newSet.has(itemId)) newSet.delete(itemId); else newSet.add(itemId); return newSet; });
    };

    const handleEditClick = (item) => { setEditingItem(item); setIsItemModalOpen(true); };

    if (loading) return <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (!pedido) return <div className="text-center py-10">Pedido não encontrado.</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const getSortIcon = (key) => { if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />; return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />; };

    return (
        <>
            <PedidoItemModal isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }} onSave={handleSaveItem} etapas={etapas} itemToEdit={editingItem} />
            <RegistrarPagamentoModal isOpen={isPagamentoModalOpen} onClose={() => setIsPagamentoModalOpen(false)} onConfirm={handleRegistrarPagamento} contas={contas} />

            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <div className="border-b pb-4">
                    <div className="flex items-center gap-2 mb-2"> <FontAwesomeIcon icon={faPen} className="text-gray-400" /> <input type="text" value={pedido.titulo || ''} onChange={(e) => handleHeaderFieldChange('titulo', e.target.value)} onBlur={() => handleHeaderFieldSave('titulo')} placeholder="Adicione um título para este pedido..." className="text-2xl font-bold w-full p-1 rounded-md focus:ring-2 focus:ring-blue-200" /> </div>
                    <h2 className="text-gray-600">Solicitação de Compra #{pedido.id}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div><p><strong>Empreendimento:</strong> {pedido.empreendimentos.nome}</p></div>
                        <div><p><strong>Status:</strong> <span className="font-semibold text-blue-600">{pedido.status}</span></p></div>
                        <div className="flex items-center gap-2"> <label className="font-bold">Entrega:</label> <input type="date" value={pedido.data_entrega_prevista || ''} onChange={(e) => handleHeaderFieldChange('data_entrega_prevista', e.target.value)} onBlur={() => handleHeaderFieldSave('data_entrega_prevista')} className="p-1 border rounded-md"/> </div>
                        <div className="flex items-center gap-2"> <label className="font-bold">Turno:</label> <select value={pedido.turno_entrega || ''} onChange={(e) => handleHeaderFieldChange('turno_entrega', e.target.value)} onBlur={() => handleHeaderFieldSave('turno_entrega')} className="p-1 border rounded-md"> <option value="">Nenhum</option> <option value="Manhã">Manhã</option> <option value="Tarde">Tarde</option> <option value="Noite">Noite</option> </select> </div>
                    </div>
                </div>
                
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Registrar Pagamento</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border flex items-center justify-between">
                        <p className="text-sm text-gray-700">Clique no botão para registrar este pedido como uma despesa no módulo financeiro.</p>
                        <button onClick={() => setIsPagamentoModalOpen(true)} disabled={isSaving} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400">
                            {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Registrar Pagamento'}
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <div className="flex items-center gap-2">
                            {/* ***** INÍCIO DO NOVO BOTÃO ***** */}
                            {pedido.status === 'Cancelado' && itens.length > 0 && (
                                <button
                                    onClick={handleEmptyItemList}
                                    className="bg-red-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                                    title="Esvaziar a lista de itens deste pedido"
                                >
                                    <FontAwesomeIcon icon={faBroom} /> Esvaziar Itens
                                </button>
                            )}
                            {/* ***** FIM DO NOVO BOTÃO ***** */}
                            <button onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
                                <FontAwesomeIcon icon={faPlus} /> Adicionar Item
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedItems(new Set(itens.map(i => i.id))) : setSelectedItems(new Set())} /></th>
                                    <th className="p-2 text-left text-xs font-medium uppercase cursor-pointer" onClick={() => requestSort('descricao_item')}>Descrição {getSortIcon('descricao_item')}</th>
                                    <th className="p-2 text-left text-xs font-medium uppercase cursor-pointer" onClick={() => requestSort('tipo_operacao')}>Tipo {getSortIcon('tipo_operacao')}</th>
                                    <th className="p-2 text-left text-xs font-medium uppercase cursor-pointer" onClick={() => requestSort('fornecedor')}>Fornecedor {getSortIcon('fornecedor')}</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-24 cursor-pointer" onClick={() => requestSort('quantidade_solicitada')}>Qtd. {getSortIcon('quantidade_solicitada')}</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32 cursor-pointer" onClick={() => requestSort('preco_unitario_real')}>Preço Unit. {getSortIcon('preco_unitario_real')}</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32 cursor-pointer" onClick={() => requestSort('custo_total_real')}>Custo Total {getSortIcon('custo_total_real')}</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-28">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sortedItens.length === 0 ? (<tr><td colSpan="8" className="text-center py-6 text-gray-500">Nenhum item adicionado.</td></tr>) : (sortedItens.map(item => (<tr key={item.id} className={selectedItems.has(item.id) ? 'bg-blue-50' : ''}>
                                        <td className="p-2 w-10"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectionChange(item.id)} /></td>
                                        <td className="p-2 font-medium">{item.descricao_item}</td>
                                        <td className="p-2 text-sm text-gray-600">
                                            {item.tipo_operacao}
                                            {item.tipo_operacao === 'Aluguel' && item.dias_aluguel && (
                                                <span className="block text-xs text-gray-500">({item.dias_aluguel} dias)</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-sm text-gray-600">{item.fornecedor?.razao_social || item.fornecedor?.nome || 'Não definido'}</td>
                                        <td className="p-2 text-center">{item.quantidade_solicitada} {item.unidade_medida}</td>
                                        <td className="p-2 text-right">{formatCurrency(item.preco_unitario_real)}</td>
                                        <td className="p-2 text-right font-semibold">{formatCurrency(item.custo_total_real)}</td>
                                        <td className="p-2 text-center"> <div className="flex justify-center items-center gap-3"> <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800" title="Editar Item"><FontAwesomeIcon icon={faPencilAlt} /></button> <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700" title="Remover Item"><FontAwesomeIcon icon={faTrash} /></button> </div> </td>
                                    </tr>)))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> Anexos do Pedido</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div><label className="block text-sm font-medium text-gray-700">Tipo de Arquivo</label><select value={newAnexoType} onChange={(e) => setNewAnexoType(e.target.value)} className="mt-1 w-full p-2 border rounded-md"><option>Nota Fiscal</option><option>Contrato</option><option>Orçamento</option><option>Outro</option></select></div>
                            <div className={newAnexoType === 'Outro' ? 'block' : 'hidden'}><label className="block text-sm font-medium text-gray-700">Descreva o arquivo</label><input type="text" value={newAnexoOutroDescricao} onChange={(e) => setNewAnexoOutroDescricao(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                            <div><label className="block text-sm font-medium text-gray-700">Arquivo</label><input type="file" id="anexo-file-input" onChange={(e) => setNewAnexoFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" /></div>
                        </div>
                        <div className="text-right mt-4"><button onClick={handleAddAnexo} disabled={isUploading || !newAnexoFile} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><FontAwesomeIcon icon={isUploading ? faSpinner : faUpload} spin={isUploading} />{isUploading ? 'Enviando...' : 'Adicionar Anexo'}</button></div>
                    </div>
                    <div className="mt-6">
                        <h4 className="font-semibold text-sm">Arquivos Anexados:</h4>
                        {anexos.length === 0 ? <p className="text-sm text-gray-500 mt-2">Nenhum anexo encontrado.</p> : (<ul className="divide-y border rounded-md mt-2">{anexos.map(anexo => (<li key={anexo.id} className="p-3 flex justify-between items-center text-sm"><div><p className="font-medium">{anexo.nome_arquivo}</p><p className="text-xs text-gray-600">{anexo.descricao || 'Sem descrição'}</p></div><div className="flex items-center gap-4"><button onClick={() => handleDownloadAnexo(anexo.caminho_arquivo)} className="text-blue-600 hover:text-blue-800" title="Baixar"><FontAwesomeIcon icon={faDownload} /></button><button onClick={() => handleRemoveAnexo(anexo)} className="text-red-500 hover:text-red-700" title="Remover"><FontAwesomeIcon icon={faTrash} /></button></div></li>))}</ul>)}
                    </div>
                </div>
            </div>
        </>
    );
}
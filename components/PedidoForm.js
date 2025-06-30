'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
// INÍCIO DA ALTERAÇÃO: Importar o useRouter
import { useRouter } from 'next/navigation';
// FIM DA ALTERAÇÃO
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faPlus, faPencilAlt, faSave, faTimes, faClock, faPaperclip, faUpload, faDownload, faSort, faSortUp, faSortDown, faPen } from '@fortawesome/free-solid-svg-icons';
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

export default function PedidoForm({ pedidoId }) {
    const supabase = createClient();
    // INÍCIO DA ALTERAÇÃO: Inicializar o router
    const router = useRouter();
    // FIM DA ALTERAÇÃO
    const [pedido, setPedido] = useState(null);
    const [itens, setItens] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [anexos, setAnexos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
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
                
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
                }
                
                if (valA < valB) { return sortConfig.direction === 'ascending' ? -1 : 1; }
                if (valA > valB) { return sortConfig.direction === 'ascending' ? 1 : -1; }
                return 0;
            });
        }
        return sortableItems;
    }, [itens, sortConfig]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos_compra')
            .select(`*, solicitante:solicitante_id(nome), empreendimentos(nome), itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome), etapa:etapa_id(nome_etapa)), historico:pedidos_compra_status_historico(*), anexos:pedidos_compra_anexos(*)`)
            .eq('id', pedidoId)
            .single();
        
        if (pedidoError) {
            console.error(pedidoError);
            setMessage('Erro ao carregar os dados do pedido.');
            setLoading(false);
            return;
        }

        setPedido(pedidoData);
        setItens(pedidoData.itens || []);
        setAnexos(pedidoData.anexos || []);

        if (pedidoData.historico) {
            const h = pedidoData.historico.sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca));
            const inicio = new Date(pedidoData.created_at);
            const cotacao = h.find(item => item.status_novo === 'Em Cotação')?.data_mudanca;
            const entrega = h.find(item => item.status_novo === 'Entregue')?.data_mudanca;
            
            setKpis({
                tempoAteCotacao: cotacao ? formatDuration(new Date(cotacao) - inicio) : 'Pendente',
                tempoAteEntrega: entrega ? formatDuration(new Date(entrega) - inicio) : 'Pendente',
            });
        }

        const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa');
        setEtapas(etapasData || []);
        setLoading(false);
    }, [pedidoId, supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleHeaderFieldChange = (field, value) => {
        setPedido(p => ({ ...p, [field]: value }));
    };

    const handleHeaderFieldSave = async (field) => {
        const { error } = await supabase
            .from('pedidos_compra')
            .update({ [field]: pedido[field] })
            .eq('id', pedidoId);
        
        if (error) {
            setMessage(`Erro ao salvar ${field.replace('_', ' ')}: ${error.message}`);
        } else {
            setMessage(`${field.replace('_', ' ')} salvo com sucesso!`);
            // INÍCIO DA ALTERAÇÃO: Atualiza os dados da aplicação
            router.refresh();
            // FIM DA ALTERAÇÃO
        }
        setTimeout(() => setMessage(''), 2000);
    };
    
    const handleAddAnexo = async () => {
        if (!newAnexoFile) {
            setMessage('Por favor, selecione um arquivo.');
            return;
        }
        setIsUploading(true);
        setMessage('Enviando anexo...');

        const { data: { user } } = await supabase.auth.getUser();
        const fileExtension = newAnexoFile.name.split('.').pop();
        
        const anexoDescricaoFinal = newAnexoType === 'Outro' ? newAnexoOutroDescricao : newAnexoType;
        const empreendimentoNome = pedido.empreendimentos.nome.replace(/ /g, '_');
        const fileName = `${anexoDescricaoFinal.replace(/ /g, '_')}_${empreendimentoNome}_Pedido#${pedido.id}.${fileExtension}`;
        
        const { error: uploadError } = await supabase.storage.from('pedidos-anexos').upload(fileName, newAnexoFile, { upsert: true });
        if (uploadError) {
            setMessage(`Erro no upload: ${uploadError.message}`);
            setIsUploading(false);
            return;
        }

        const { error: dbError } = await supabase.from('pedidos_compra_anexos').insert({
            pedido_compra_id: pedido.id,
            caminho_arquivo: fileName,
            nome_arquivo: newAnexoFile.name,
            descricao: anexoDescricaoFinal,
            usuario_id: user.id
        });

        if (dbError) {
            setMessage(`Erro ao salvar no banco: ${dbError.message}`);
        } else {
            setMessage('Anexo adicionado com sucesso!');
            setNewAnexoFile(null);
            setNewAnexoType('Nota Fiscal');
            setNewAnexoOutroDescricao('');
            document.getElementById('anexo-file-input').value = '';
            fetchData();
        }
        setIsUploading(false);
    };

    const handleRemoveAnexo = async (anexo) => {
        if (!window.confirm(`Tem certeza que deseja remover o anexo "${anexo.nome_arquivo}"?`)) return;
        await supabase.storage.from('pedidos-anexos').remove([anexo.caminho_arquivo]);
        await supabase.from('pedidos_compra_anexos').delete().eq('id', anexo.id);
        setMessage('Anexo removido com sucesso!');
        fetchData();
    };

    const handleDownloadAnexo = async (caminho) => {
        const { data, error } = await supabase.storage.from('pedidos-anexos').createSignedUrl(caminho, 60);
        if (error) setMessage(`Erro ao gerar link de download: ${error.message}`);
        else window.open(data.signedUrl, '_blank');
    }
    
    const handleSaveItem = async (itemData) => {
        const isEditing = Boolean(itemData.id);
        
        const dataToUpsert = {
            ...itemData,
            pedido_compra_id: pedidoId,
            quantidade_solicitada: parseFloat(itemData.quantidade_solicitada) || 0,
            preco_unitario_real: itemData.preco_unitario_real === '' || itemData.preco_unitario_real === null ? null : parseFloat(itemData.preco_unitario_real),
            custo_total_real: (parseFloat(itemData.preco_unitario_real) || 0) * (parseFloat(itemData.quantidade_solicitada) || 0)
        };
        
        let error;
        if(isEditing) {
            const { error: updateError } = await supabase.from('pedidos_compra_itens').update(dataToUpsert).eq('id', itemData.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('pedidos_compra_itens').insert(dataToUpsert);
            error = insertError;
        }

        if (error) {
            return { success: false, error: error.message };
        } else {
            setMessage(`Item ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
            fetchData();
            return { success: true };
        }
    };

    const handleRemoveItem = async (itemId) => {
        if (!window.confirm('Tem certeza que deseja remover este item?')) return;
        const { error } = await supabase.from('pedidos_compra_itens').delete().eq('id', itemId);
        if (error) setMessage('Erro ao remover item: ' + error.message);
        else setItens(prev => prev.filter(item => item.id !== itemId));
    };

    const handleSelectionChange = (itemId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId);
            else newSet.add(itemId);
            return newSet;
        });
    };
    const handleDecompose = async () => {
        if (selectedItems.size === 0) { alert('Selecione pelo menos um item para decompor.'); return; }
        const itemsToMove = itens.filter(item => selectedItems.has(item.id));
        if (!confirm(`Você tem certeza que deseja criar um novo pedido com os ${itemsToMove.length} itens selecionados?`)) return;
        setIsSaving(true);
        setMessage('Decompondo pedido...');
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newPedido, error: newPedidoError } = await supabase.from('pedidos_compra').insert({ empreendimento_id: pedido.empreendimento_id, solicitante_id: user.id, status: 'Pedido Realizado', justificativa: `Pedido decomposto do #${pedido.id}` }).select().single();
        if (newPedidoError) { setMessage('Erro ao criar novo pedido: ' + newPedidoError.message); setIsSaving(false); return; }
        const itemUpdates = itemsToMove.map(item => ({ ...item, id: undefined, created_at: undefined, pedido_compra_id: newPedido.id }));
        const { error: updateError } = await supabase.from('pedidos_compra_itens').insert(itemUpdates);
        if (updateError) {
             setMessage('Erro ao mover itens: ' + updateError.message);
             await supabase.from('pedidos_compra').delete().eq('id', newPedido.id);
        } else {
             setMessage(`Novo pedido #${newPedido.id} criado com sucesso!`);
             fetchData();
             setSelectedItems(new Set());
        }
        setIsSaving(false);
    };

    const handleEditClick = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    if (loading) return <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (!pedido) return <div className="text-center py-10">Pedido não encontrado.</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />;
        return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />;
    };

    return (
        <>
            <PedidoItemModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSave={handleSaveItem} etapas={etapas} itemToEdit={editingItem} />
            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <div className="border-b pb-4">
                    <div className="flex items-center gap-2 mb-2">
                         <FontAwesomeIcon icon={faPen} className="text-gray-400" />
                         <input
                            type="text"
                            value={pedido.titulo || ''}
                            onChange={(e) => handleHeaderFieldChange('titulo', e.target.value)}
                            onBlur={() => handleHeaderFieldSave('titulo')}
                            placeholder="Adicione um título para este pedido..."
                            className="text-2xl font-bold w-full p-1 rounded-md focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <h2 className="text-gray-600">Solicitação de Compra #{pedido.id}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div><p><strong>Empreendimento:</strong> {pedido.empreendimentos.nome}</p></div>
                        <div><p><strong>Status:</strong> <span className="font-semibold text-blue-600">{pedido.status}</span></p></div>
                        <div className="flex items-center gap-2">
                            <label className="font-bold">Entrega:</label>
                            <input type="date" value={pedido.data_entrega_prevista || ''} onChange={(e) => handleHeaderFieldChange('data_entrega_prevista', e.target.value)} onBlur={() => handleHeaderFieldSave('data_entrega_prevista')} className="p-1 border rounded-md"/>
                        </div>
                         <div className="flex items-center gap-2">
                            <label className="font-bold">Turno:</label>
                            <select value={pedido.turno_entrega || ''} onChange={(e) => handleHeaderFieldChange('turno_entrega', e.target.value)} onBlur={() => handleHeaderFieldSave('turno_entrega')} className="p-1 border rounded-md">
                                <option value="">Nenhum</option>
                                <option value="Manhã">Manhã</option>
                                <option value="Tarde">Tarde</option>
                                <option value="Noite">Noite</option>
                            </select>
                        </div>
                    </div>
                </div>

                {kpis && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Indicadores do Pedido</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <KpiCard title="Tempo até Cotação" value={kpis.tempoAteCotacao} icon={faClock} color="yellow" />
                            <KpiCard title="Tempo Total de Entrega" value={kpis.tempoAteEntrega} icon={faClock} color="green" />
                        </div>
                    </div>
                )}
                
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2 text-sm">
                            <FontAwesomeIcon icon={faPlus} /> Adicionar Item
                        </button>
                    </div>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedItems(new Set(itens.map(i => i.id))) : setSelectedItems(new Set())} /></th>
                                    <th className="p-2 text-left text-xs font-medium uppercase cursor-pointer" onClick={() => requestSort('descricao_item')}>Descrição {getSortIcon('descricao_item')}</th>
                                    <th className="p-2 text-left text-xs font-medium uppercase cursor-pointer" onClick={() => requestSort('fornecedor')}>Fornecedor {getSortIcon('fornecedor')}</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-24 cursor-pointer" onClick={() => requestSort('quantidade_solicitada')}>Qtd. {getSortIcon('quantidade_solicitada')}</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32 cursor-pointer" onClick={() => requestSort('preco_unitario_real')}>Preço Unit. {getSortIcon('preco_unitario_real')}</th>
                                    <th className="p-2 text-right text-xs font-medium uppercase w-32 cursor-pointer" onClick={() => requestSort('custo_total_real')}>Custo Total {getSortIcon('custo_total_real')}</th>
                                    <th className="p-2 text-center text-xs font-medium uppercase w-28">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sortedItens.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-6 text-gray-500">Nenhum item adicionado.</td></tr>
                                ) : (
                                    sortedItens.map(item => (
                                        <tr key={item.id} className={selectedItems.has(item.id) ? 'bg-blue-50' : ''}>
                                            <td className="p-2 w-10"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectionChange(item.id)} /></td>
                                            <td className="p-2 font-medium">{item.descricao_item}</td>
                                            <td className="p-2 text-sm text-gray-600">{item.fornecedor?.nome || 'Não definido'}</td>
                                            <td className="p-2 text-center">{item.quantidade_solicitada} {item.unidade_medida}</td>
                                            <td className="p-2 text-right">{formatCurrency(item.preco_unitario_real)}</td>
                                            <td className="p-2 text-right font-semibold">{formatCurrency(item.custo_total_real)}</td>
                                            <td className="p-2 text-center">
                                                <div className="flex justify-center items-center gap-3">
                                                    <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800" title="Editar Item"><FontAwesomeIcon icon={faPencilAlt} /></button>
                                                    <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700" title="Remover Item"><FontAwesomeIcon icon={faTrash} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> Anexos do Pedido</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tipo de Arquivo</label>
                                <select value={newAnexoType} onChange={(e) => setNewAnexoType(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                    <option>Nota Fiscal</option>
                                    <option>Contrato</option>
                                    <option>Orçamento</option>
                                    <option>Outro</option>
                                </select>
                            </div>
                            <div className={newAnexoType === 'Outro' ? 'block' : 'hidden'}>
                                <label className="block text-sm font-medium text-gray-700">Descreva o arquivo</label>
                                <input type="text" value={newAnexoOutroDescricao} onChange={(e) => setNewAnexoOutroDescricao(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Arquivo</label>
                                <input type="file" id="anexo-file-input" onChange={(e) => setNewAnexoFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100" />
                            </div>
                        </div>
                        <div className="text-right mt-4">
                            <button onClick={handleAddAnexo} disabled={isUploading || !newAnexoFile} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                <FontAwesomeIcon icon={isUploading ? faSpinner : faUpload} spin={isUploading} />
                                {isUploading ? 'Enviando...' : 'Adicionar Anexo'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6">
                        <h4 className="font-semibold text-sm">Arquivos Anexados:</h4>
                        {anexos.length === 0 ? <p className="text-sm text-gray-500 mt-2">Nenhum anexo encontrado.</p> : (
                            <ul className="divide-y border rounded-md mt-2">
                                {anexos.map(anexo => (
                                    <li key={anexo.id} className="p-3 flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-medium">{anexo.nome_arquivo}</p>
                                            <p className="text-xs text-gray-600">{anexo.descricao || 'Sem descrição'}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => handleDownloadAnexo(anexo.caminho_arquivo)} className="text-blue-600 hover:text-blue-800" title="Baixar"><FontAwesomeIcon icon={faDownload} /></button>
                                            <button onClick={() => handleRemoveAnexo(anexo)} className="text-red-500 hover:text-red-700" title="Remover"><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-2">Decompor Pedido</h3>
                    <p className="text-sm text-gray-500 mb-4">Selecione os itens na tabela acima e use o botão abaixo para movê-los para um novo pedido de compra.</p>
                    <button onClick={handleDecompose} disabled={isSaving || selectedItems.size === 0} className="bg-orange-500 text-white px-3 py-2 rounded-md shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2">Gerar Pedido com Itens Selecionados ({selectedItems.size})</button>
                </div>
                
                {message && <div className="text-center mt-4 p-2 bg-gray-100 rounded-md text-sm">{message}</div>}
            </div>
        </>
    );
}
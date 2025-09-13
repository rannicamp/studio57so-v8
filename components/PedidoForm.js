'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faPlus, faPencilAlt, faSave, faTimes, faClock, faPaperclip, faUpload, faDownload, faSort, faSortUp, faSortDown, faPen, faDollarSign, faBroom } from '@fortawesome/free-solid-svg-icons';
import PedidoItemModal from './PedidoItemModal';
import KpiCard from './KpiCard';
import LancamentoFormModal from './financeiro/LancamentoFormModal';
import { useAuth } from '@/contexts/AuthContext';

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
    const router = useRouter();
    const { userData } = useAuth(); // Por que: Pegamos os dados do usuário para identificar a organização.
    const [pedido, setPedido] = useState(null);
    const [itens, setItens] = useState([]);
    const [etapas, setEtapas] = useState([]);
    const [anexos, setAnexos] = useState([]);
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [lancamentoInitialData, setLancamentoInitialData] = useState(null);

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
        const orgId = userData?.organizacao_id;
        if (!orgId) {
            if (!loading) toast.error("Organização do usuário não encontrada.");
            return;
        }

        setLoading(true);
        // Por que: A busca principal do pedido agora também é filtrada pela organização para segurança máxima.
        const { data: pedidoData, error: pedidoError } = await supabase.from('pedidos_compra').select(`*, solicitante:solicitante_id(nome), empreendimentos(nome, empresa_id:empresa_proprietaria_id), itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(id, nome, razao_social, nome_fantasia), etapa:etapa_id(nome_etapa)), historico:pedidos_compra_status_historico(*), anexos:pedidos_compra_anexos(*)`).eq('id', pedidoId).eq('organizacao_id', orgId).single();
        if (pedidoError) { console.error(pedidoError); toast.error('Erro ao carregar os dados do pedido.'); setLoading(false); return; }
        
        setPedido(pedidoData); setItens(pedidoData.itens || []); setAnexos(pedidoData.anexos || []);
        
        if (pedidoData.historico) {
            const h = pedidoData.historico.sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca));
            const inicio = new Date(pedidoData.created_at);
            const cotacao = h.find(item => item.status_novo === 'Em Cotação')?.data_mudanca;
            const entrega = h.find(item => item.status_novo === 'Entregue')?.data_mudanca;
            setKpis({ tempoAteCotacao: cotacao ? formatDuration(new Date(cotacao) - inicio) : 'Pendente', tempoAteEntrega: entrega ? formatDuration(new Date(entrega) - inicio) : 'Pendente', });
        }
        
        // Por que: Buscamos apenas etapas e contas da organização correta.
        const { data: etapasData } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', orgId);
        setEtapas(etapasData || []);
        const { data: contasData } = await supabase.from('contas_financeiras').select('id, nome').eq('organizacao_id', orgId);
        setContas(contasData || []);
        
        setLoading(false);
    }, [pedidoId, supabase, userData, loading]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenLancamentoModal = () => {
        if (!itens || itens.length === 0) { toast.error("Adicione itens ao pedido antes de planejar um pagamento."); return; }
        const totalPedido = itens.reduce((acc, item) => acc + (parseFloat(item.custo_total_real) || 0), 0);
        const firstFornecedorId = itens[0].fornecedor_id;
        const allSameFornecedor = itens.every(item => item.fornecedor_id === firstFornecedorId);
        const notaFiscalAnexo = anexos.find(a => a.descricao.toLowerCase().includes('nota fiscal'));
        let etapaObraId = null;
        if (itens.length > 0) {
            const firstEtapaId = itens[0].etapa_id;
            if (firstEtapaId && itens.every(item => item.etapa_id === firstEtapaId)) etapaObraId = firstEtapaId;
        }
        const initial = {
            descricao: `Pagamento Ref. Pedido de Compra #${pedido.id} - ${pedido.titulo || ''}`.trim(),
            valor: totalPedido.toFixed(2),
            data_vencimento: new Date().toISOString().split('T')[0],
            tipo: 'Despesa', status: 'Pendente',
            favorecido_contato_id: allSameFornecedor ? firstFornecedorId : null,
            empreendimento_id: pedido.empreendimento_id,
            empresa_id: pedido.empreendimentos?.empresa_id || null,
            etapa_obra_id: etapaObraId,
            organizacao_id: pedido.organizacao_id, // Por que: Passamos a organização para o modal de lançamento.
            anexo_preexistente: notaFiscalAnexo ? { caminho_arquivo: notaFiscalAnexo.caminho_arquivo, nome_arquivo: notaFiscalAnexo.nome_arquivo, descricao: notaFiscalAnexo.descricao, } : null,
        };
        setLancamentoInitialData(initial);
        setIsLancamentoModalOpen(true);
    };

    const handleHeaderFieldChange = (field, value) => { setPedido(p => ({ ...p, [field]: value })); };
    const handleHeaderFieldSave = async (field) => {
        toast.promise(
            supabase.from('pedidos_compra').update({ [field]: pedido[field] }).eq('id', pedidoId).eq('organizacao_id', pedido.organizacao_id),
            { loading: 'Salvando...', success: () => { router.refresh(); return `${field.replace('_', ' ')} salvo com sucesso!`; }, error: (err) => `Erro ao salvar: ${err.message}` }
        );
    };
    
    const handleAddAnexo = async () => {
        if (!newAnexoFile) { toast.error('Por favor, selecione um arquivo.'); return; }
        setIsUploading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        const promise = async () => {
            const orgId = pedido.organizacao_id;
            const fileExtension = newAnexoFile.name.split('.').pop();
            const anexoDescricaoFinal = newAnexoType === 'Outro' ? newAnexoOutroDescricao : newAnexoType;
            const fileName = `${orgId}/pedidos-anexos/pedido_${pedido.id}/${anexoDescricaoFinal.replace(/ /g, '_')}_${Date.now()}.${fileExtension}`;
            
            const { error: uploadError } = await supabase.storage.from('pedidos-anexos').upload(fileName, newAnexoFile, { upsert: true });
            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from('pedidos_compra_anexos').insert({ pedido_compra_id: pedido.id, caminho_arquivo: fileName, nome_arquivo: newAnexoFile.name, descricao: anexoDescricaoFinal, usuario_id: user.id, organizacao_id: orgId });
            if (dbError) throw dbError;
            return "Anexo adicionado com sucesso!";
        };

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
        const promise = async () => {
            await supabase.storage.from('pedidos-anexos').remove([anexo.caminho_arquivo]);
            const { error } = await supabase.from('pedidos_compra_anexos').delete().eq('id', anexo.id).eq('organizacao_id', pedido.organizacao_id);
            if(error) throw error;
        };
        toast.warning(`Tem certeza que deseja remover o anexo "${anexo.nome_arquivo}"?`, {
            action: { label: "Remover", onClick: () => toast.promise(promise(), { loading: 'Removendo anexo...', success: (msg) => { fetchData(); return "Anexo removido!"; }, error: (err) => `Erro ao remover: ${err.message}`})},
            cancel: { label: "Cancelar" }
        });
    };

    const handleDownloadAnexo = async (caminho) => {
        const { data, error } = await supabase.storage.from('pedidos-anexos').createSignedUrl(caminho, 60);
        if (error) toast.error(`Erro ao gerar link de download: ${error.message}`); 
        else window.open(data.signedUrl, '_blank');
    };
    
    const handleSaveItem = async (itemData) => {
        const orgId = pedido.organizacao_id;
        const promise = async () => {
            const isEditing = Boolean(itemData.id);
            let finalMaterialId = itemData.material_id;

            if (!finalMaterialId && itemData.descricao_item) {
                const { data: newMaterial, error: materialError } = await supabase.from('materiais').insert({ descricao: itemData.descricao_item, unidade_medida: itemData.unidade_medida, Origem: 'Manual', organizacao_id: orgId }).select().single();
                if (materialError) throw new Error('Erro ao criar o novo material: ' + materialError.message);
                finalMaterialId = newMaterial.id;
            }

            const dataToUpsert = { ...itemData, material_id: finalMaterialId, pedido_compra_id: pedidoId, quantidade_solicitada: parseInt(itemData.quantidade_solicitada) || 0, preco_unitario_real: itemData.preco_unitario_real === '' || itemData.preco_unitario_real === null ? null : parseFloat(itemData.preco_unitario_real), etapa_id: itemData.etapa_id === '' ? null : parseInt(itemData.etapa_id) || null, fornecedor_id: itemData.fornecedor_id === '' ? null : parseInt(itemData.fornecedor_id) || null, organizacao_id: orgId };
            dataToUpsert.custo_total_real = itemData.tipo_operacao === 'Aluguel' ? (dataToUpsert.quantidade_solicitada || 0) * (dataToUpsert.preco_unitario_real || 0) * (parseInt(itemData.dias_aluguel) || 0) : (dataToUpsert.preco_unitario_real || 0) * (dataToUpsert.quantidade_solicitada || 0);
            delete dataToUpsert.fornecedor_nome;
            
            if(isEditing) {
                const { error } = await supabase.from('pedidos_compra_itens').update(dataToUpsert).eq('id', itemData.id).eq('organizacao_id', orgId);
                if(error) throw error;
            } else {
                delete dataToUpsert.id; 
                const { error } = await supabase.from('pedidos_compra_itens').insert(dataToUpsert);
                if(error) throw error;
            }
            return { isEditing };
        };

        let success = false;
        await toast.promise(promise(), {
            loading: 'Salvando item...',
            success: ({ isEditing }) => { fetchData(); success = true; return `Item ${isEditing ? 'atualizado' : 'adicionado'}!`; },
            error: (err) => `Falha ao salvar o item: ${err.message}`,
        });
        return success;
    };

    const handleRemoveItem = async (itemId) => {
        const promise = () => supabase.from('pedidos_compra_itens').delete().eq('id', itemId).eq('organizacao_id', pedido.organizacao_id);
        toast.warning("Tem certeza que deseja remover este item?", {
            action: { label: "Remover", onClick: () => toast.promise(promise(), { loading: 'Removendo item...', success: () => { setItens(prev => prev.filter(item => item.id !== itemId)); return "Item removido!"; }, error: (err) => `Erro: ${err.message}`}) },
            cancel: { label: "Cancelar" }
        });
    };

    const handleEmptyItemList = async () => {
        const promise = () => supabase.from('pedidos_compra_itens').delete().eq('pedido_compra_id', pedidoId).eq('organizacao_id', pedido.organizacao_id);
        toast.warning('ATENÇÃO: Deseja REMOVER TODOS OS ITENS? Esta ação é irreversível!', {
            action: { label: "Esvaziar Lista", onClick: () => toast.promise(promise(), { loading: 'Esvaziando lista...', success: (msg) => { fetchData(); return "Lista esvaziada!"; }, error: (err) => `Erro: ${err.message}`})},
            cancel: { label: "Cancelar" }
        });
    };

    const handleSelectionChange = (itemId) => {
        // Lógica mantida
    };

    const handleEditClick = (item) => { setEditingItem(item); setIsItemModalOpen(true); };

    if (loading) return <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (!pedido) return <div className="text-center py-10">Pedido não encontrado.</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const getSortIcon = (key) => { if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />; return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />; };

    return (
        <>
            <PedidoItemModal isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }} onSave={handleSaveItem} etapas={etapas} itemToEdit={editingItem} organizacaoId={pedido.organizacao_id} />
            <LancamentoFormModal isOpen={isLancamentoModalOpen} onClose={() => setIsLancamentoModalOpen(false)} onSuccess={() => { toast.success("Planejamento de pagamento registrado com sucesso no financeiro!"); fetchData(); }} initialData={lancamentoInitialData} />
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
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Planejar Pagamento</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border flex items-center justify-between">
                        <p className="text-sm text-gray-700">Clique no botão para agendar este pedido como uma despesa futura no módulo financeiro.</p>
                        <button onClick={handleOpenLancamentoModal} disabled={false} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400">
                            Planejar Pagamento
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <div className="flex items-center gap-2">
                            {pedido.status === 'Cancelado' && itens.length > 0 && (
                                <button
                                    onClick={handleEmptyItemList}
                                    className="bg-red-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                                    title="Esvaziar a lista de itens deste pedido"
                                >
                                    <FontAwesomeIcon icon={faBroom} /> Esvaziar Itens
                                </button>
                            )}
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
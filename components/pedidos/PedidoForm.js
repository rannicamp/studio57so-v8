// components/pedidos/PedidoForm.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faTrash, faPlus, faPencilAlt, faPaperclip, faUpload, faDownload, 
    faSort, faSortUp, faSortDown, faPen, faDollarSign, faBroom, 
    faHandHoldingDollar, faAlignLeft, faCheck, 
    faCheckCircle, faClock
} from '@fortawesome/free-solid-svg-icons';
import PedidoItemModal from './PedidoItemModal';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificarGrupo } from '@/utils/notificacoes';

const formatDuration = (milliseconds) => {
    if (milliseconds < 0 || isNaN(milliseconds)) return '0 dias';
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h`;
    return result.trim() === '' ? 'Menos de 1h' : result;
};

const fetchPedidoData = async (supabase, pedidoId, organizacaoId) => {
    if (!pedidoId || !organizacaoId) throw new Error("ID do Pedido ou da Organização não encontrado.");

    // CORREÇÃO AQUI: Trocamos 'pedidos_compra_status_historico' pela tabela nova 'pedidos_compra_historico_fases'
    const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos_compra')
        .select(`
            *, 
            solicitante:solicitante_id(nome), 
            empreendimentos(nome, empresa_id:empresa_proprietaria_id), 
            itens:pedidos_compra_itens(*, 
                fornecedor:fornecedor_id(id, nome, razao_social, nome_fantasia), 
                etapa:etapa_id(nome_etapa)
            ), 
            historico:pedidos_compra_historico_fases(
                data_movimentacao,
                fase_nova:fase_nova_id(nome)
            ),
            anexos:pedidos_compra_anexos(*),
            lancamentos:lancamentos(id) 
        `)
        .eq('id', pedidoId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (pedidoError) throw new Error(`Ao carregar o pedido: ${pedidoError.message}`);

    const { data: etapasData, error: etapasError } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', organizacaoId);
    if (etapasError) throw new Error(`Ao carregar etapas: ${etapasError.message}`);
    
    const { data: contasData, error: contasError } = await supabase.from('contas_financeiras').select('id, nome').eq('organizacao_id', organizacaoId);
    if (contasError) throw new Error(`Ao carregar contas: ${contasError.message}`);

    const { data: fornecedoresData, error: fornError } = await supabase
        .from('clientes')
        .select('id, nome, razao_social, nome_fantasia')
        .eq('organizacao_id', organizacaoId)
        .eq('tipo', 'Fornecedor')
        .order('nome');
    
    if (fornError) console.error("Erro ao carregar fornecedores:", fornError);

    return { 
        pedido: pedidoData, 
        etapas: etapasData || [], 
        contas: contasData || [],
        fornecedores: fornecedoresData || [] 
    };
};


export default function PedidoForm({ pedidoId }) {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [pedidoHeader, setPedidoHeader] = useState(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
    const [lancamentoInitialData, setLancamentoInitialData] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [newAnexoFile, setNewAnexoFile] = useState(null);
    const [newAnexoType, setNewAnexoType] = useState('Nota Fiscal');
    const [newAnexoOutroDescricao, setNewAnexoOutroDescricao] = useState('');
    const [kpis, setKpis] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'descricao_item', direction: 'ascending' });
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [selectedFornecedorBulk, setSelectedFornecedorBulk] = useState('');


    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['pedido', pedidoId, organizacaoId],
        queryFn: () => fetchPedidoData(supabase, pedidoId, organizacaoId),
        enabled: !!pedidoId && !!organizacaoId,
    });
    
    const pedido = data?.pedido;
    const itens = data?.pedido?.itens || [];
    const anexos = data?.pedido?.anexos || [];
    const fornecedores = data?.fornecedores || [];

    useEffect(() => {
        if (pedido) {
            setPedidoHeader(pedido);
            // CORREÇÃO KPI: Ajustado para ler a estrutura da nova tabela de histórico
            if (pedido.historico && pedido.historico.length > 0) {
                const h = [...pedido.historico].sort((a,b) => new Date(a.data_movimentacao) - new Date(b.data_movimentacao));
                const inicio = new Date(pedido.created_at);
                
                // Procura a primeira vez que entrou em 'Em Cotação' e 'Entregue'
                // Nota: Usamos o operador ?. para evitar erro se fase_nova for nulo
                const cotacaoItem = h.find(item => item.fase_nova?.nome === 'Em Cotação');
                const entregaItem = h.find(item => item.fase_nova?.nome === 'Entregue');

                const dataCotacao = cotacaoItem ? new Date(cotacaoItem.data_movimentacao) : null;
                const dataEntrega = entregaItem ? new Date(entregaItem.data_movimentacao) : null;

                setKpis({ 
                    tempoAteCotacao: dataCotacao ? formatDuration(dataCotacao - inicio) : 'Pendente', 
                    tempoAteEntrega: dataEntrega ? formatDuration(dataEntrega - inicio) : 'Pendente' 
                });
            } else {
                 setKpis({ tempoAteCotacao: 'Pendente', tempoAteEntrega: 'Pendente' });
            }
        }
    }, [pedido]);

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

    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId, organizacaoId] });
            queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
        },
    };

    const updateHeaderMutation = useMutation({
        ...mutationOptions,
        mutationFn: (fieldData) => supabase.from('pedidos_compra').update(fieldData).eq('id', pedidoId).eq('organizacao_id', organizacaoId),
        onSuccess: (data, variables) => {
            mutationOptions.onSuccess();
            const fieldName = Object.keys(variables)[0].replace('_', ' ');
            toast.success(`${fieldName} salvo com sucesso!`);
        },
        onError: (err) => toast.error(`Erro ao salvar: ${err.message}`)
    });

    const bulkUpdateFornecedorMutation = useMutation({
        ...mutationOptions,
        mutationFn: async ({ itemIds, fornecedorId }) => {
            if (!itemIds || itemIds.length === 0) return;
            const idToSave = fornecedorId ? parseInt(fornecedorId) : null;
            const { error } = await supabase
                .from('pedidos_compra_itens')
                .update({ fornecedor_id: idToSave })
                .in('id', itemIds)
                .eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            mutationOptions.onSuccess();
            toast.success("Fornecedor atualizado nos itens selecionados!");
            setSelectedItems(new Set());
            setSelectedFornecedorBulk('');
        },
        onError: (err) => toast.error(`Erro na atualização em massa: ${err.message}`)
    });

    const addAnexoMutation = useMutation({
        ...mutationOptions,
        mutationFn: async (file) => {
            const anexoDescricaoFinal = newAnexoType === 'Outro' ? newAnexoOutroDescricao : newAnexoType;
            const fileName = `${organizacaoId}/pedidos-anexos/pedido_${pedido.id}/${anexoDescricaoFinal.replace(/ /g, '_')}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage.from('pedidos-anexos').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { error: dbError } = await supabase.from('pedidos_compra_anexos').insert({ pedido_compra_id: pedido.id, caminho_arquivo: fileName, nome_arquivo: file.name, descricao: anexoDescricaoFinal, usuario_id: user.id, organizacao_id: organizacaoId });
            if (dbError) throw dbError;
        },
        onSuccess: () => {
            mutationOptions.onSuccess();
            toast.success("Anexo adicionado com sucesso!");
            setNewAnexoFile(null); setNewAnexoType('Nota Fiscal'); setNewAnexoOutroDescricao('');
            if(document.getElementById('anexo-file-input')) document.getElementById('anexo-file-input').value = '';
        },
        onError: (err) => toast.error(`Erro no upload: ${err.message}`),
    });

    const removeAnexoMutation = useMutation({
        ...mutationOptions,
        mutationFn: async (anexo) => {
            await supabase.storage.from('pedidos-anexos').remove([anexo.caminho_arquivo]);
            const { error } = await supabase.from('pedidos_compra_anexos').delete().eq('id', anexo.id).eq('organizacao_id', organizacaoId);
            if(error) throw error;
        },
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Anexo removido!"); },
        onError: (err) => toast.error(`Erro ao remover: ${err.message}`)
    });

    const saveItemMutation = useMutation({
        ...mutationOptions,
        mutationFn: async (itemData) => {
            const isEditing = !!itemData.id;
            const custoTotal = (parseFloat(itemData.quantidade_solicitada) || 0) * (parseFloat(itemData.preco_unitario_real) || 0);
            const dataToSave = {
                material_id: itemData.material_id || null,
                descricao_item: itemData.descricao_item,
                quantidade_solicitada: parseFloat(itemData.quantidade_solicitada) || 1,
                unidade_medida: itemData.unidade_medida || 'unid.',
                fornecedor_id: itemData.fornecedor_id || null,
                preco_unitario_real: itemData.preco_unitario_real === '' || itemData.preco_unitario_real === null ? null : parseFloat(itemData.preco_unitario_real),
                etapa_id: itemData.etapa_id || null,
                subetapa_id: itemData.subetapa_id || null,
                tipo_operacao: itemData.tipo_operacao || 'Compra',
                dias_aluguel: itemData.dias_aluguel === '' || itemData.dias_aluguel === null ? null : parseInt(itemData.dias_aluguel, 10),
                custo_total_real: custoTotal,
                pedido_compra_id: pedidoId,
                organizacao_id: organizacaoId,
            };
            if (isEditing) {
                const { data, error } = await supabase.from('pedidos_compra_itens').update(dataToSave).eq('id', itemData.id).eq('organizacao_id', organizacaoId).select();
                if (error) { throw error; }
                if (!data || data.length === 0) { throw new Error("O item não foi encontrado para atualização."); }
                return { data: data[0], isEditing, itemDesc: itemData.descricao_item };
            } else {
                const { data, error } = await supabase.from('pedidos_compra_itens').insert(dataToSave).select();
                if (error) throw error;
                if (!data || data.length === 0) { throw new Error("Falha ao criar o novo item."); }
                return { data: data[0], isEditing, itemDesc: itemData.descricao_item };
            }
        },
        onSuccess: async (result) => {
            mutationOptions.onSuccess();
            const { isEditing, itemDesc } = result;
            toast.success(`Item ${isEditing ? 'atualizado' : 'adicionado'}!`);
            setIsItemModalOpen(false);
            setEditingItem(null);

            if (!isEditing) {
                await notificarGrupo({
                    permissao: 'pedidos',
                    titulo: '📦 Nova Solicitação de Material',
                    mensagem: `${user?.nome || 'Alguém'} adicionou "${itemDesc}" ao Pedido #${pedidoId}.`,
                    link: `/pedidos/${pedidoId}`,
                    tipo: 'alerta',
                    organizacaoId
                });
            }
        },
        onError: (err) => toast.error(`Falha ao salvar o item: ${err.message}`),
    });

    const removeItemMutation = useMutation({
        ...mutationOptions,
        mutationFn: (itemId) => supabase.from('pedidos_compra_itens').delete().eq('id', itemId).eq('organizacao_id', organizacaoId),
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Item removido!"); },
        onError: (err) => toast.error(`Erro ao remover item: ${err.message}`),
    });

    const emptyItemListMutation = useMutation({
        ...mutationOptions,
        mutationFn: () => supabase.from('pedidos_compra_itens').delete().eq('pedido_compra_id', pedidoId).eq('organizacao_id', organizacaoId),
        onSuccess: () => { mutationOptions.onSuccess(); toast.success("Lista esvaziada!"); },
        onError: (err) => toast.error(`Erro ao esvaziar a lista: ${err.message}`),
    });
    
    const handleHeaderFieldChange = (field, value) => { setPedidoHeader(p => ({ ...p, [field]: value })); };
    const handleHeaderFieldSave = async (field) => { updateHeaderMutation.mutate({ [field]: pedidoHeader[field] }); };
    const handleAddAnexo = async () => { if (!newAnexoFile) { toast.error('Por favor, selecione um arquivo.'); return; } addAnexoMutation.mutate(newAnexoFile); };
    const handleRemoveAnexo = (anexo) => { toast.warning(`Tem certeza que deseja remover o anexo "${anexo.nome_arquivo}"?`, { action: { label: "Remover", onClick: () => removeAnexoMutation.mutate(anexo) }, cancel: { label: "Cancelar" } }); };
    const handleDownloadAnexo = async (caminho) => { 
        try {
            const { data, error } = await supabase.storage.from('pedidos-anexos').createSignedUrl(caminho, 60);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast.error("Erro ao baixar anexo.");
        }
    };
    const handleSaveItem = (itemData) => { saveItemMutation.mutate(itemData); };
    const handleRemoveItem = (itemId) => { toast.warning("Tem certeza que deseja remover este item?", { action: { label: "Remover", onClick: () => removeItemMutation.mutate(itemId) }, cancel: { label: "Cancelar" } }); };
    const handleEmptyItemList = () => { toast.warning('ATENÇÃO: Deseja REMOVER TODOS OS ITENS? Esta ação é irreversível!', { action: { label: "Esvaziar Lista", onClick: () => emptyItemListMutation.mutate() }, cancel: { label: "Cancelar" } }); };
    
    const handleOpenLancamentoModal = () => {
        if (!pedido || !pedido.itens || pedido.itens.length === 0) {
            toast.error("Adicione itens ao pedido antes de planejar um pagamento.");
            return;
        }
        const totalPedidoValor = pedido.itens.reduce((acc, item) => acc + (parseFloat(item.custo_total_real) || 0), 0);
        const firstFornecedorId = pedido.itens[0].fornecedor_id;
        const allSameFornecedor = pedido.itens.every(item => item.fornecedor_id === firstFornecedorId);
        const notaFiscalAnexo = pedido.anexos.find(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal'));
        let etapaId = null;
        if (pedido.itens.length > 0) {
            const firstEtapaId = pedido.itens[0].etapa_id;
            if (firstEtapaId && pedido.itens.every(item => item.etapa_id === firstEtapaId)) {
                etapaId = firstEtapaId;
            }
        }
        const initial = {
            descricao: `Pagamento Ref. Pedido de Compra #${pedido.id} - ${pedido.titulo || ''}`.trim(),
            valor: totalPedidoValor.toFixed(2),
            data_vencimento: new Date().toISOString().split('T')[0],
            tipo: 'Despesa',
            status: 'Pendente',
            favorecido_contato_id: allSameFornecedor ? firstFornecedorId : null,
            empreendimento_id: pedido.empreendimento_id,
            empresa_id: pedido.empreendimentos?.empresa_id || null,
            etapa_id: etapaId, 
            anexo_preexistente: notaFiscalAnexo ? {
                caminho_arquivo: notaFiscalAnexo.caminho_arquivo,
                nome_arquivo: notaFiscalAnexo.nome_arquivo,
                descricao: notaFiscalAnexo.descricao,
            } : null,
            pedido_compra_id: pedido.id
        };
        setLancamentoInitialData(initial);
        setIsLancamentoModalOpen(true);
    };
    
    const handleSelectionChange = (itemId) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(itemId)) newSelection.delete(itemId);
        else newSelection.add(itemId);
        setSelectedItems(newSelection);
    };
    const handleBulkUpdateFornecedor = () => {
        if (!selectedFornecedorBulk) {
            toast.error("Selecione um fornecedor para aplicar aos itens selecionados.");
            return;
        }
        bulkUpdateFornecedorMutation.mutate({
            itemIds: Array.from(selectedItems),
            fornecedorId: selectedFornecedorBulk
        });
    };
    const handleEditClick = (item) => { setEditingItem(item); setIsItemModalOpen(true); };

    if (isLoading) return <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (isError) return <div className="text-center py-10 text-red-600">{error.message}</div>;
    if (!pedido || !pedidoHeader) return <div className="text-center py-10">Pedido não encontrado ou você não tem permissão para acessá-lo.</div>;

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const getSortIcon = (key) => { if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />; return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />; };

    const cutoffDate = new Date('2025-11-12T23:59:59');
    const dataSolicitacao = new Date(pedido.data_solicitacao);
    const isAntigo = dataSolicitacao <= cutoffDate;
    const isLancadoDeFato = pedido.lancamentos && pedido.lancamentos.length > 0;
    
    const jaLancado = isLancadoDeFato || isAntigo;
    
    let helpText = "Clique no botão para agendar este pedido como uma despesa futura.";
    if (isLancadoDeFato) {
        helpText = "Este pedido já possui um planejamento financeiro registrado.";
    } else if (isAntigo) {
        helpText = "Este pedido é anterior a 12/11/2025 e foi ignorado da pendência financeira.";
    }

    return (
        <>
            <PedidoItemModal isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }} onSave={handleSaveItem} itemToEdit={editingItem} pedidoId={pedidoId} />
            <LancamentoFormModal isOpen={isLancamentoModalOpen} onClose={() => setIsLancamentoModalOpen(false)} onSuccess={() => { toast.success("Planejamento de pagamento registrado com sucesso no financeiro!"); queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId, organizacaoId] }) }} initialData={lancamentoInitialData} />
            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <div className="border-b pb-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-2"> <FontAwesomeIcon icon={faPen} className="text-gray-400" /> <input type="text" value={pedidoHeader.titulo || ''} onChange={(e) => handleHeaderFieldChange('titulo', e.target.value)} onBlur={() => handleHeaderFieldSave('titulo')} placeholder="Adicione um título para este pedido..." className="text-2xl font-bold w-full p-1 rounded-md focus:ring-2 focus:ring-blue-200" /> </div>
                            <h2 className="text-gray-600">Solicitação de Compra #{pedido.id}</h2>
                        </div>
                        {kpis && (
                            <div className="flex gap-4 text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                                <div className="text-center">
                                    <p className="font-semibold text-gray-700">Cotação</p>
                                    <p className="flex items-center gap-1 justify-center"><FontAwesomeIcon icon={faClock}/> {kpis.tempoAteCotacao}</p>
                                </div>
                                <div className="w-px bg-gray-300"></div>
                                <div className="text-center">
                                    <p className="font-semibold text-gray-700">Entrega</p>
                                    <p className="flex items-center gap-1 justify-center"><FontAwesomeIcon icon={faClock}/> {kpis.tempoAteEntrega}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div><p><strong>Empreendimento:</strong> {pedido.empreendimentos.nome}</p></div>
                        <div><p><strong>Status:</strong> <span className="font-semibold text-blue-600">{pedido.status}</span></p></div>
                        <div className="flex items-center gap-2"> <label className="font-bold">Entrega:</label> <input type="date" value={pedidoHeader.data_entrega_prevista || ''} onChange={(e) => handleHeaderFieldChange('data_entrega_prevista', e.target.value)} onBlur={() => handleHeaderFieldSave('data_entrega_prevista')} className="p-1 border rounded-md"/> </div>
                        <div className="flex items-center gap-2"> <label className="font-bold">Turno:</label> <select value={pedidoHeader.turno_entrega || ''} onChange={(e) => handleHeaderFieldChange('turno_entrega', e.target.value)} onBlur={() => handleHeaderFieldSave('turno_entrega')} className="p-1 border rounded-md"> <option value="">Nenhum</option> <option value="Manhã">Manhã</option> <option value="Tarde">Tarde</option> <option value="Noite">Noite</option> </select> </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faAlignLeft} />
                            Observações do Solicitante (para o time de Compras)
                        </label>
                        <textarea
                            value={pedidoHeader.observacoes || ''}
                            onChange={(e) => handleHeaderFieldChange('observacoes', e.target.value)}
                            onBlur={() => handleHeaderFieldSave('observacoes')}
                            rows="3"
                            placeholder="Ex: Material de uso urgente, priorizar cotação com Fornecedor X..."
                            className="mt-1 w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>
                
                <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faDollarSign} /> Planejar Pagamento</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border flex items-center justify-between">
                        <p className="text-sm text-gray-700">
                            {helpText}
                        </p>
                        <button 
                            onClick={handleOpenLancamentoModal} 
                            disabled={jaLancado} 
                            className={`
                                text-white px-4 py-2 rounded-md shadow-sm flex items-center justify-center gap-2
                                ${jaLancado 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-green-600 hover:bg-green-700'
                                }
                            `}
                        >
                            <FontAwesomeIcon icon={jaLancado ? faCheckCircle : faHandHoldingDollar} />
                            {jaLancado ? 'Pagamento Planejado' : 'Planejar Pagamento'}
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

                    {selectedItems.size > 0 && (
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200 flex flex-wrap items-center gap-4 mb-4 shadow-sm animate-fade-in">
                            <span className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{selectedItems.size}</span>
                                item(s) selecionado(s)
                            </span>
                            
                            <div className="flex items-center gap-2 ml-auto">
                                <label className="text-sm text-gray-700 mr-1">Definir Fornecedor:</label>
                                <select
                                    value={selectedFornecedorBulk}
                                    onChange={(e) => setSelectedFornecedorBulk(e.target.value)}
                                    className="p-1.5 border rounded text-sm min-w-[200px] focus:ring-2 focus:ring-blue-300 outline-none"
                                >
                                    <option value="">Selecione para todos...</option>
                                    {fornecedores.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.nome_fantasia || f.razao_social || f.nome}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleBulkUpdateFornecedor}
                                    disabled={bulkUpdateFornecedorMutation.isPending || !selectedFornecedorBulk}
                                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    {bulkUpdateFornecedorMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={itens.length > 0 && selectedItems.size === itens.length}
                                            onChange={(e) => e.target.checked ? setSelectedItems(new Set(itens.map(i => i.id))) : setSelectedItems(new Set())} 
                                            className="cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
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
                                {sortedItens.length === 0 ? (<tr><td colSpan="8" className="text-center py-6 text-gray-500">Nenhum item adicionado.</td></tr>) : (sortedItens.map(item => (<tr key={item.id} className={selectedItems.has(item.id) ? 'bg-blue-50 transition-colors' : 'hover:bg-gray-50 transition-colors'}>
                                    <td className="p-2 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItems.has(item.id)} 
                                            onChange={() => handleSelectionChange(item.id)} 
                                            className="cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-2 font-medium text-sm">{item.descricao_item}</td>
                                    <td className="p-2 text-sm text-gray-600">
                                        {item.tipo_operacao}
                                        {item.tipo_operacao === 'Aluguel' && item.dias_aluguel && (
                                            <span className="block text-xs text-gray-500">({item.dias_aluguel} dias)</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-sm text-gray-600">
                                        {item.fornecedor?.nome_fantasia || item.fornecedor?.razao_social || item.fornecedor?.nome || <span className="text-gray-400 italic">Não definido</span>}
                                    </td>
                                    <td className="p-2 text-center text-sm">{item.quantidade_solicitada} {item.unidade_medida}</td>
                                    <td className="p-2 text-right text-sm">{formatCurrency(item.preco_unitario_real)}</td>
                                    <td className="p-2 text-right font-semibold text-sm">{formatCurrency(item.custo_total_real)}</td>
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
                        <div className="text-right mt-4"><button onClick={handleAddAnexo} disabled={addAnexoMutation.isPending || !newAnexoFile} className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><FontAwesomeIcon icon={addAnexoMutation.isPending ? faSpinner : faUpload} spin={addAnexoMutation.isPending} />{addAnexoMutation.isPending ? 'Enviando...' : 'Adicionar Anexo'}</button></div>
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
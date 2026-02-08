'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faEdit, 
    faTrash, 
    faExchangeAlt, 
    faSearch, 
    faSpinner, 
    faCheck, 
    faTimes,
    faSort,
    faSortUp,
    faSortDown,
    faLayerGroup,
    faExclamationTriangle,
    faSkullCrossbones,
    faPlus, 
    faSave
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

const ITEMS_PER_PAGE = 100; // Carregar de 100 em 100
const MATERIAIS_STATE_KEY = 'STUDIO57_MATERIAIS_UI_STATE_V1'; // Chave para salvar no navegador

export default function GerenciadorMateriais() {
    const supabase = createClient();
    
    // --- ESTADOS ---
    // Controle para saber se já restauramos o backup do navegador
    const [isInitialized, setIsInitialized] = useState(false);

    const [materiais, setMateriais] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true); 
    const [page, setPage] = useState(0); 
    
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 500);

    const [orderBy, setOrderBy] = useState('nome'); 
    const [orderDirection, setOrderDirection] = useState('asc'); 

    const [selectedIds, setSelectedIds] = useState([]);

    // --- PERSISTÊNCIA DE DADOS (NOVO ✨) ---

    // 1. Restaurar o estado ao carregar a página
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem(MATERIAIS_STATE_KEY);
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    // Só restaura se tiver valor válido
                    if (parsed.searchTerm !== undefined) setSearchTerm(parsed.searchTerm);
                    if (parsed.orderBy !== undefined) setOrderBy(parsed.orderBy);
                    if (parsed.orderDirection !== undefined) setOrderDirection(parsed.orderDirection);
                    if (parsed.selectedIds !== undefined) setSelectedIds(parsed.selectedIds);
                } catch (e) {
                    console.error("Erro ao restaurar estado:", e);
                }
            }
            // Marca como inicializado para liberar as buscas
            setIsInitialized(true);
        }
    }, []);

    // 2. Salvar o estado sempre que mudar (mas só se já estiver inicializado)
    useEffect(() => {
        if (!isInitialized) return;

        const stateToSave = {
            searchTerm,
            orderBy,
            orderDirection,
            selectedIds
        };
        localStorage.setItem(MATERIAIS_STATE_KEY, JSON.stringify(stateToSave));
    }, [searchTerm, orderBy, orderDirection, selectedIds, isInitialized]);


    // --- LÓGICA DE SCROLL INFINITO (MANTIDA) ---
    const observer = useRef();
    const lastMaterialElementRef = useCallback(node => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Edição, Criação, Mesclagem, Exclusão (Estados)
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newMaterial, setNewMaterial] = useState({ nome: '', unidade_medida: 'UN', preco_unitario: 0, descricao: '' });
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [targetSearch, setTargetSearch] = useState('');
    const [targetList, setTargetList] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [userPassword, setUserPassword] = useState('');

    // --- CARREGAMENTO DE DADOS ---

    // Resetar a lista quando os filtros mudam
    useEffect(() => {
        if (!isInitialized) return; // IMPORTANTE: Não reseta antes de carregar o cache
        
        setMateriais([]); 
        setPage(0); 
        setHasMore(true); 
        // A busca será disparada pelo efeito abaixo (page changed)
    }, [debouncedSearch, orderBy, orderDirection, isInitialized]);

    // Buscar dados (Disparado quando a página muda ou quando inicializa)
    useEffect(() => {
        if (!isInitialized) return; // IMPORTANTE: Bloqueia busca antes da restauração
        
        const fetchMateriais = async () => {
            setLoading(true);
            try {
                const from = page * ITEMS_PER_PAGE;
                const to = from + ITEMS_PER_PAGE - 1;

                let query = supabase
                    .from('materiais')
                    .select('*')
                    .order(orderBy, { ascending: orderDirection === 'asc' })
                    .range(from, to);

                if (debouncedSearch) {
                    query = query.ilike('nome', `%${debouncedSearch}%`);
                }

                const { data, error } = await query;
                if (error) throw error;

                setMateriais(prev => {
                    // Se for página 0, substitui. Se for scroll, adiciona.
                    if (page === 0) return data || [];
                    
                    // Remove duplicatas
                    const newItems = data || [];
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
                    return [...prev, ...uniqueNewItems];
                });

                if ((data || []).length < ITEMS_PER_PAGE) {
                    setHasMore(false);
                }
            } catch (error) {
                console.error(error);
                toast.error('Erro ao carregar materiais.');
            } finally {
                setLoading(false);
            }
        };

        fetchMateriais();
    }, [page, debouncedSearch, orderBy, orderDirection, isInitialized]);


    // --- FUNÇÕES AUXILIARES ---
    const reloadList = () => {
        setPage(0);
        setHasMore(true);
        // O efeito do useEffect([page]) vai cuidar de buscar quando a página resetar pra 0
        // Mas para garantir atualização imediata após ação:
        setMateriais([]); // Força limpeza visual
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === materiais.length) setSelectedIds([]);
        else setSelectedIds(materiais.map(m => m.id));
    };

    const handleSort = (field) => {
        if (orderBy === field) setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc');
        else { setOrderBy(field); setOrderDirection('asc'); }
    };

    const SortIcon = ({ field }) => {
        if (orderBy !== field) return <FontAwesomeIcon icon={faSort} className="text-gray-300 ml-2 text-xs" />;
        return orderDirection === 'asc' ? <FontAwesomeIcon icon={faSortUp} className="text-blue-600 ml-2" /> : <FontAwesomeIcon icon={faSortDown} className="text-blue-600 ml-2" />;
    };

    // --- LÓGICA DE CRIAÇÃO ---
    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            const { data: userData, error: userError } = await supabase
                .from('usuarios').select('organizacao_id').eq('id', user.id).single();

            if (userError || !userData?.organizacao_id) throw new Error("Organização não encontrada.");

            const { error } = await supabase.from('materiais').insert([{
                nome: newMaterial.nome,
                descricao: newMaterial.descricao || newMaterial.nome,
                unidade_medida: newMaterial.unidade_medida,
                preco_unitario: parseFloat(newMaterial.preco_unitario),
                organizacao_id: userData.organizacao_id,
                classificacao: 'Insumo',
                Origem: 'PRÓPRIO'
            }]);

            if (error) throw error;
            toast.success('Material criado com sucesso!');
            setIsCreateModalOpen(false);
            setNewMaterial({ nome: '', unidade_medida: 'UN', preco_unitario: 0, descricao: '' });
            reloadList();
        } catch (error) { console.error(error); toast.error('Erro ao criar material.'); } finally { setLoading(false); }
    };

    // --- LOGICA MESCLAGEM ---
    useEffect(() => {
        const searchTargets = async () => {
            if (!isMergeModalOpen || !targetSearch) { setTargetList([]); return; }
            const { data } = await supabase.from('materiais').select('*')
                .not('id', 'in', `(${selectedIds.join(',')})`) 
                .ilike('nome', `%${targetSearch}%`).limit(10);
            setTargetList(data || []);
        };
        searchTargets();
    }, [targetSearch, isMergeModalOpen, selectedIds]);

    const handleUpdate = async () => {
        try {
            const { error } = await supabase.from('materiais').update({ 
                nome: editForm.nome, unidade_medida: editForm.unidade_medida, preco_unitario: editForm.preco_unitario 
            }).eq('id', editingId);
            if (error) throw error;
            toast.success('Material atualizado!');
            setEditingId(null);
            setMateriais(prev => prev.map(m => m.id === editingId ? { ...m, ...editForm } : m));
        } catch (error) { toast.error('Erro ao atualizar.'); }
    };

    const handleDeleteSafe = async (id) => {
        try {
            const { error } = await supabase.from('materiais').delete().eq('id', id);
            if (error) throw error;
            toast.success('Material excluído.');
            setMateriais(prev => prev.filter(m => m.id !== id));
        } catch (error) {
            toast.error('Material em uso. Use a caveira para forçar exclusão.', {
                action: { label: 'Forçar', onClick: () => { const item = materiais.find(m => m.id === id); setItemToDelete(item); setIsDeleteModalOpen(true); setUserPassword(''); } },
                duration: 5000
            });
        }
    };

    const handleForceDelete = async () => {
        if (!itemToDelete || !userPassword) return;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) { toast.error("Erro usuário."); setLoading(false); return; }
            const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: userPassword });
            if (authError) { toast.error("Senha incorreta!"); setLoading(false); return; }

            const { error: rpcError } = await supabase.rpc('excluir_material_forca_bruta', { p_material_id: itemToDelete.id });
            if (rpcError) throw rpcError;

            toast.success(`Item destruído com sucesso!`);
            setIsDeleteModalOpen(false); setItemToDelete(null); setUserPassword(''); reloadList();
        } catch (error) { console.error(error); toast.error('Erro fatal.'); } finally { setLoading(false); }
    };

    const handleMerge = async () => {
        if (selectedIds.length === 0 || !selectedTarget) return;
        if (!confirm(`Fusão de ${selectedIds.length} itens?`)) return;
        setLoading(true);
        try {
            for (const oldId of selectedIds) {
                if (oldId === selectedTarget.id) continue;
                const { error } = await supabase.rpc('unificar_materiais', { old_material_id: oldId, new_material_id: selectedTarget.id });
                if (error) throw error;
            }
            toast.success('Unificação concluída!');
            setIsMergeModalOpen(false); setSelectedIds([]); setSelectedTarget(null); setTargetSearch(''); reloadList();
        } catch (error) { toast.error('Erro na unificação.'); } finally { setLoading(false); }
    };

    const openMergeModal = (specificId = null) => {
        if (specificId) setSelectedIds([specificId]);
        if (selectedIds.length === 0 && !specificId) { toast.warning("Selecione itens."); return; }
        setIsMergeModalOpen(true);
    };

    // Renderização condicional para evitar "flicker" inicial antes de carregar cache
    if (!isInitialized) return (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 py-20">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p className="mt-4">Carregando preferências...</p>
        </div>
    );

    return (
        <div className="bg-white rounded-lg shadow p-6 relative">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-800">Materiais Próprios</h2>
                    
                    <button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm">
                        <FontAwesomeIcon icon={faPlus} /> Novo Material
                    </button>

                    {selectedIds.length > 0 && (
                        <button onClick={() => openMergeModal()} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-bold hover:bg-orange-200 transition-all flex items-center gap-2 animate-pulse">
                            <FontAwesomeIcon icon={faLayerGroup} /> Unificar {selectedIds.length}
                        </button>
                    )}
                </div>
                <div className="relative w-full md:w-64">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
                </div>
            </div>

            {/* TABELA COM SCROLL INFINITO */}
            <div className="overflow-x-auto border rounded-lg max-h-[70vh] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer" checked={materiais.length > 0 && selectedIds.length === materiais.length} onChange={toggleSelectAll} /></th>
                            <th onClick={() => handleSort('nome')} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Nome <SortIcon field="nome" /></th>
                            <th onClick={() => handleSort('unidade_medida')} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Unidade <SortIcon field="unidade_medida" /></th>
                            <th onClick={() => handleSort('preco_unitario')} className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100">Preço <SortIcon field="preco_unitario" /></th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {materiais.map((mat, index) => {
                            // O SEGREDO DO SCROLL INFINITO ESTÁ AQUI NA REF
                            const isLastElement = materiais.length === index + 1;
                            
                            return (
                                <tr 
                                    key={`${mat.id}-${index}`} 
                                    ref={isLastElement ? lastMaterialElementRef : null}
                                    className={`transition-colors ${selectedIds.includes(mat.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="px-4 py-4 text-center"><input type="checkbox" className="w-4 h-4 cursor-pointer" checked={selectedIds.includes(mat.id)} onChange={() => toggleSelect(mat.id)} /></td>
                                    {editingId === mat.id ? (
                                        <>
                                            <td className="px-6 py-4"><input className="border p-2 rounded w-full" value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} autoFocus /></td>
                                            <td className="px-6 py-4"><input className="border p-2 rounded w-24" value={editForm.unidade_medida} onChange={e => setEditForm({...editForm, unidade_medida: e.target.value})} /></td>
                                            <td className="px-6 py-4"><input type="number" step="0.01" className="border p-2 rounded w-32" value={editForm.preco_unitario} onChange={e => setEditForm({...editForm, preco_unitario: e.target.value})} /></td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <button onClick={handleUpdate} className="text-green-600 p-2"><FontAwesomeIcon icon={faCheck} /></button>
                                                <button onClick={() => setEditingId(null)} className="text-red-600 p-2"><FontAwesomeIcon icon={faTimes} /></button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{mat.nome}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{mat.unidade_medida}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.preco_unitario)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                                <button onClick={() => { setEditingId(mat.id); setEditForm(mat); }} className="text-blue-600 hover:text-blue-900 p-1" title="Editar"><FontAwesomeIcon icon={faEdit} /></button>
                                                <button onClick={() => openMergeModal(mat.id)} className="text-orange-500 hover:text-orange-700 p-1" title="Unificar"><FontAwesomeIcon icon={faExchangeAlt} /></button>
                                                <button onClick={() => handleDeleteSafe(mat.id)} className="text-red-600 hover:text-red-900 p-1" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                                <button onClick={() => { setItemToDelete(mat); setIsDeleteModalOpen(true); setUserPassword(''); }} className="text-red-900 hover:text-black p-1 opacity-50 hover:opacity-100" title="Exclusão Forçada (Perigo!)"><FontAwesomeIcon icon={faSkullCrossbones} /></button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                        
                        {/* Loading Indicator no Final da Lista */}
                        {loading && (
                            <tr>
                                <td colSpan="5" className="text-center py-4 bg-gray-50">
                                    <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600 mr-2" />
                                    Carregando mais materiais...
                                </td>
                            </tr>
                        )}
                        
                        {!loading && materiais.length === 0 && (
                            <tr><td colSpan="5" className="text-center py-8 text-gray-500">Nenhum material encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAIS (Criação, Mesclagem e Exclusão) */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-gray-800">Novo Material</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input type="text" required className="w-full p-2 border rounded" value={newMaterial.nome} onChange={e => setNewMaterial({...newMaterial, nome: e.target.value})} /></div>
                            <div className="flex gap-4"><div className="w-1/3"><label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label><input type="text" required className="w-full p-2 border rounded" value={newMaterial.unidade_medida} onChange={e => setNewMaterial({...newMaterial, unidade_medida: e.target.value.toUpperCase()})} /></div><div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Preço</label><input type="number" step="0.01" className="w-full p-2 border rounded" value={newMaterial.preco_unitario} onChange={e => setNewMaterial({...newMaterial, preco_unitario: e.target.value})} /></div></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label><textarea className="w-full p-2 border rounded" rows="2" value={newMaterial.descricao} onChange={e => setNewMaterial({...newMaterial, descricao: e.target.value})} /></div>
                            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button><button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Salvar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {isMergeModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faLayerGroup} className="text-orange-500"/> Unificar Materiais</h3>
                        <div className="bg-orange-50 p-4 rounded mb-6 text-sm text-orange-800">⚠️ Você selecionou {selectedIds.length} itens para serem <strong>excluídos</strong> e fundidos em um só.</div>
                        <div className="mb-4"><label className="block text-sm font-bold mb-2">Destino:</label><input type="text" placeholder="Buscar..." className="w-full p-3 border rounded" value={targetSearch} onChange={e => setTargetSearch(e.target.value)} autoFocus />{targetList.length > 0 && (<ul className="mt-2 border rounded max-h-48 overflow-y-auto bg-white">{targetList.map(t => (<li key={t.id} onClick={() => setSelectedTarget(t)} className={`p-3 cursor-pointer hover:bg-blue-50 flex justify-between ${selectedTarget?.id === t.id ? 'bg-blue-100' : ''}`}><span>{t.nome}</span><span className="text-xs bg-gray-100 px-2 py-1 rounded">{t.unidade_medida}</span></li>))}</ul>)}</div>
                        <div className="flex justify-end gap-3"><button onClick={() => setIsMergeModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">Cancelar</button><button onClick={handleMerge} disabled={!selectedTarget || loading} className="px-4 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 disabled:opacity-50">Confirmar Fusão</button></div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && itemToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md border-4 border-red-600 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 bg-red-600 h-2"></div>
                        <div className="text-center mb-6"><div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 text-3xl" /></div><h3 className="text-2xl font-bold text-red-700">Ação Destrutiva!</h3><p className="text-gray-600 mt-2">Você vai varrer <strong>"{itemToDelete.nome}"</strong>.</p></div>
                        <div className="mb-6"><label className="block text-sm font-bold text-gray-700 mb-2">Senha:</label><input type="password" placeholder="Sua senha..." className="w-full p-3 border-2 border-red-200 rounded-lg text-center text-lg" value={userPassword} onChange={e => setUserPassword(e.target.value)} autoFocus /></div>
                        <div className="flex justify-between gap-3"><button onClick={() => { setIsDeleteModalOpen(false); setUserPassword(''); }} className="flex-1 px-4 py-3 bg-gray-200 font-bold rounded-lg">CANCELAR</button><button onClick={handleForceDelete} disabled={!userPassword || loading} className="flex-1 px-4 py-3 bg-red-700 text-white font-bold rounded-lg hover:bg-red-800 flex justify-center items-center gap-2">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSkullCrossbones} />} EXCLUIR</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
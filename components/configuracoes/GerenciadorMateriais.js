'use client';

import { useState, useEffect } from 'react';
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
    faSortDown 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

export default function GerenciadorMateriais() {
    const supabase = createClient();
    
    // --- ESTADOS ---
    const [materiais, setMateriais] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Busca
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch] = useDebounce(searchTerm, 500);

    // Ordenação (Novos Estados)
    const [orderBy, setOrderBy] = useState('nome'); // Campo padrão
    const [orderDirection, setOrderDirection] = useState('asc'); // Direção padrão

    // Edição
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Mesclagem (Merge)
    const [mergingMaterial, setMergingMaterial] = useState(null);
    const [targetSearch, setTargetSearch] = useState('');
    const [targetList, setTargetList] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null);

    // --- CARREGAMENTO DE DADOS ---
    const fetchMateriais = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('materiais')
                .select('*')
                // A mágica da ordenação acontece aqui:
                .order(orderBy, { ascending: orderDirection === 'asc' })
                .limit(50);

            if (debouncedSearch) {
                query = query.ilike('nome', `%${debouncedSearch}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setMateriais(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar materiais.');
        } finally {
            setLoading(false);
        }
    };

    // Recarrega sempre que a busca ou a ORDENAÇÃO mudar
    useEffect(() => {
        fetchMateriais();
    }, [debouncedSearch, orderBy, orderDirection]);

    // --- LÓGICA DE ORDENAÇÃO ---
    const handleSort = (field) => {
        // Se clicou no mesmo campo, inverte a ordem
        if (orderBy === field) {
            setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Se clicou em campo novo, define ele como ascendente
            setOrderBy(field);
            setOrderDirection('asc');
        }
    };

    // Componente visual da setinha no cabeçalho
    const SortIcon = ({ field }) => {
        if (orderBy !== field) return <FontAwesomeIcon icon={faSort} className="text-gray-300 ml-2 text-xs" />;
        return orderDirection === 'asc' 
            ? <FontAwesomeIcon icon={faSortUp} className="text-blue-600 ml-2" />
            : <FontAwesomeIcon icon={faSortDown} className="text-blue-600 ml-2" />;
    };

    // --- OUTRAS LÓGICAS (Mantidas) ---
    useEffect(() => {
        const searchTargets = async () => {
            if (!mergingMaterial || !targetSearch) {
                setTargetList([]);
                return;
            }
            const { data } = await supabase
                .from('materiais')
                .select('*')
                .neq('id', mergingMaterial.id)
                .ilike('nome', `%${targetSearch}%`)
                .limit(10);
            setTargetList(data || []);
        };
        searchTargets();
    }, [targetSearch, mergingMaterial]);

    const handleUpdate = async () => {
        try {
            const { error } = await supabase
                .from('materiais')
                .update({ 
                    nome: editForm.nome, 
                    unidade_medida: editForm.unidade_medida,
                    preco_unitario: editForm.preco_unitario 
                })
                .eq('id', editingId);

            if (error) throw error;
            toast.success('Material atualizado!');
            setEditingId(null);
            fetchMateriais();
        } catch (error) {
            toast.error('Erro ao atualizar.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza? Se este material estiver em uso, dará erro. Use a função MESCLAR.')) return;
        try {
            const { error } = await supabase.from('materiais').delete().eq('id', id);
            if (error) throw error;
            toast.success('Material excluído.');
            fetchMateriais();
        } catch (error) {
            toast.error('Este material está em uso. Tente mesclar.');
        }
    };

    const handleMerge = async () => {
        if (!mergingMaterial || !selectedTarget) return;
        if (!confirm(`ATENÇÃO: "${mergingMaterial.nome}" deixará de existir. Confirma?`)) return;

        try {
            const { error } = await supabase
                .rpc('unificar_materiais', { 
                    old_material_id: mergingMaterial.id, 
                    new_material_id: selectedTarget.id 
                });

            if (error) throw error;
            toast.success('Materiais unificados com sucesso!');
            setMergingMaterial(null);
            setSelectedTarget(null);
            setTargetSearch('');
            fetchMateriais();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao unificar materiais.');
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">Gerenciar Materiais Próprios</h2>
                
                {/* Campo de Busca */}
                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Buscar material..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400" />
                </div>
            </div>

            {/* Tabela de Materiais */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* Cabeçalho Ordenável: NOME */}
                            <th 
                                onClick={() => handleSort('nome')}
                                className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Nome <SortIcon field="nome" />
                            </th>
                            
                            {/* Cabeçalho Ordenável: UNIDADE */}
                            <th 
                                onClick={() => handleSort('unidade_medida')}
                                className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Unidade <SortIcon field="unidade_medida" />
                            </th>
                            
                            {/* Cabeçalho Ordenável: PREÇO */}
                            <th 
                                onClick={() => handleSort('preco_unitario')}
                                className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Preço <SortIcon field="preco_unitario" />
                            </th>
                            
                            {/* Cabeçalho Fixo: AÇÕES */}
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="4" className="text-center py-8 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                        ) : materiais.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-8 text-gray-500">Nenhum material encontrado.</td></tr>
                        ) : materiais.map((mat) => (
                            <tr key={mat.id} className="hover:bg-blue-50 transition-colors">
                                {editingId === mat.id ? (
                                    <>
                                        <td className="px-6 py-4"><input className="border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 outline-none" value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} autoFocus /></td>
                                        <td className="px-6 py-4"><input className="border p-2 rounded w-24 focus:ring-2 focus:ring-blue-500 outline-none" value={editForm.unidade_medida} onChange={e => setEditForm({...editForm, unidade_medida: e.target.value})} /></td>
                                        <td className="px-6 py-4"><input type="number" step="0.01" className="border p-2 rounded w-32 focus:ring-2 focus:ring-blue-500 outline-none" value={editForm.preco_unitario} onChange={e => setEditForm({...editForm, preco_unitario: e.target.value})} /></td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={handleUpdate} className="bg-green-100 text-green-700 p-2 rounded hover:bg-green-200 transition-colors" title="Salvar"><FontAwesomeIcon icon={faCheck} /></button>
                                            <button onClick={() => setEditingId(null)} className="bg-red-100 text-red-700 p-2 rounded hover:bg-red-200 transition-colors" title="Cancelar"><FontAwesomeIcon icon={faTimes} /></button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{mat.nome}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{mat.unidade_medida}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mat.preco_unitario)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                            <button 
                                                onClick={() => { setEditingId(mat.id); setEditForm(mat); }} 
                                                className="text-blue-600 hover:text-blue-900 p-1" 
                                                title="Editar"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button 
                                                onClick={() => setMergingMaterial(mat)} 
                                                className="text-orange-500 hover:text-orange-700 p-1" 
                                                title="Unificar Duplicado"
                                            >
                                                <FontAwesomeIcon icon={faExchangeAlt} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(mat.id)} 
                                                className="text-red-600 hover:text-red-900 p-1" 
                                                title="Excluir"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Mesclagem (Mantido igual) */}
            {mergingMaterial && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                            <FontAwesomeIcon icon={faExchangeAlt} className="mr-2 text-orange-500"/>
                            Unificar Materiais (Correção)
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Você vai apagar o item incorreto <strong>{mergingMaterial.nome}</strong>, movendo todo o histórico dele para o item correto.
                        </p>
                        
                        <div className="bg-red-50 p-3 rounded border border-red-200 mb-4">
                            <span className="font-bold text-red-800 block text-xs uppercase mb-1">Será Apagado (Origem):</span> 
                            {mergingMaterial.nome}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Selecione o Material Correto (Destino):</label>
                            <input 
                                type="text"
                                placeholder="Busque o material correto..."
                                className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={targetSearch}
                                onChange={e => setTargetSearch(e.target.value)}
                                autoFocus
                            />
                            {targetList.length > 0 && (
                                <ul className="mt-2 border rounded max-h-40 overflow-y-auto shadow-sm">
                                    {targetList.map(t => (
                                        <li 
                                            key={t.id} 
                                            onClick={() => setSelectedTarget(t)}
                                            className={`p-2 cursor-pointer border-b last:border-0 hover:bg-blue-50 flex justify-between items-center ${selectedTarget?.id === t.id ? 'bg-blue-100 font-bold text-blue-800' : ''}`}
                                        >
                                            <span>{t.nome}</span>
                                            <span className="text-gray-500 text-xs bg-gray-100 px-2 rounded-full">{t.unidade_medida}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {selectedTarget && (
                            <div className="bg-green-50 p-3 rounded border border-green-200 mb-6">
                                <span className="font-bold text-green-800 block text-xs uppercase mb-1">Vai Permanecer (Destino):</span> 
                                {selectedTarget.nome}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => { setMergingMaterial(null); setSelectedTarget(null); setTargetSearch(''); }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleMerge}
                                disabled={!selectedTarget}
                                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                            >
                                Confirmar Unificação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
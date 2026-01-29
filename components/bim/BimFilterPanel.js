'use client';

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faTrash, faSearch, faFilter, faTimes, faMagic, faEraser, faEyeSlash 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const STANDARD_FIELDS = [
    { value: 'familia', label: 'Família' },
    { value: 'tipo', label: 'Tipo' },
    { value: 'categoria', label: 'Categoria' },
    { value: 'nivel', label: 'Nível' },
    { value: 'status_execucao', label: 'Status' },
    { value: 'sistema', label: 'Sistema' }
];

export default function BimFilterPanel({ viewer, projetoBimId }) {
    const supabase = createClient();
    const { organizacao_id } = useAuth();
    
    const [filters, setFilters] = useState([
        { id: 1, field: 'familia', value: '' }
    ]);
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [activeFieldRow, setActiveFieldRow] = useState(null);

    // --- GERENCIAMENTO DAS LINHAS ---
    const addRow = () => {
        const newId = filters.length > 0 ? Math.max(...filters.map(f => f.id)) + 1 : 1;
        setFilters([...filters, { id: newId, field: 'categoria', value: '' }]);
    };

    const removeRow = (id) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id, key, newValue) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [key]: newValue } : f));
        if (key === 'field') setSuggestions([]);
    };

    // --- AUTOCOMPLETE (RPC) ---
    const fetchSuggestions = async (rowId, field, searchText) => {
        if (!searchText || searchText.length < 2) {
            setSuggestions([]); 
            return;
        }
        
        setActiveFieldRow(rowId);
        
        try {
            const { data, error } = await supabase
                .rpc('get_bim_field_values', {
                    p_organizacao_id: organizacao_id,
                    p_campo: field,
                    p_search: searchText
                });

            if (error) throw error;
            setSuggestions(data.map(d => d.valor));
        } catch (error) {
            console.error("Erro no autocomplete:", error);
        }
    };

    // --- APLICAR O FILTRO (A Mágica Visual Multi-Model) ---
    const applyFilters = async () => {
        if (!viewer) {
            toast.error("Visualizador não carregado.");
            return;
        }

        setIsSearching(true);
        try {
            // 1. Monta a Query no Supabase
            let query = supabase.from('elementos_bim').select('external_id');
            query = query.eq('organizacao_id', organizacao_id);

            filters.forEach(f => {
                if (!f.value) return;
                const isStandard = STANDARD_FIELDS.some(sf => sf.value === f.field);
                
                if (isStandard) {
                    query = query.ilike(f.field, `%${f.value}%`);
                } else {
                    query = query.ilike(`propriedades->>${f.field}`, `%${f.value}%`);
                }
            });

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.warning("Nenhum elemento encontrado no banco.");
                return;
            }

            // Lista de External IDs encontrados no banco
            const targetExternalIds = new Set(data.map(d => d.external_id));
            let totalFoundInViewer = 0;

            // 2. Procura em TODOS os modelos carregados (Multi-Model Support)
            const allModels = viewer.impl.modelQueue().getModels();
            
            // Limpa cores anteriores
            viewer.clearThemingColors();
            
            // --- CORREÇÃO: Usando Promise.all para esperar a busca assíncrona terminar ---
            const searchPromises = allModels.map(model => {
                return new Promise((resolve) => {
                    model.getExternalIdMapping((mapping) => {
                        const dbIdsToIsolate = [];
                        
                        // Verifica quais externalIds do banco existem neste modelo
                        targetExternalIds.forEach(extId => {
                            if (mapping[extId]) {
                                dbIdsToIsolate.push(mapping[extId]);
                            }
                        });

                        // Se achou peças neste modelo, isola e pinta
                        if (dbIdsToIsolate.length > 0) {
                            // Isola neste modelo específico
                            viewer.isolate(dbIdsToIsolate, model);
                            
                            // Opcional: Pintar de azul para destacar
                            dbIdsToIsolate.forEach(dbId => {
                                viewer.setThemingColor(dbId, new THREE.Vector4(0, 0.5, 1, 0.6), model);
                            });

                            totalFoundInViewer += dbIdsToIsolate.length;
                        } else {
                            // Se não tem nada deste filtro neste modelo, esconde o modelo todo
                            viewer.isolate([], model);
                        }
                        resolve(); // Avisa que terminou este modelo
                    });
                });
            });

            // Espera TODOS os modelos responderem antes de dar o veredito
            await Promise.all(searchPromises);

            if (totalFoundInViewer > 0) {
                toast.success(`${totalFoundInViewer} elementos isolados na visualização!`);
                // Tenta dar zoom geral
                setTimeout(() => viewer.fitToView(), 500); 
            } else {
                toast.warning("Elementos existem no banco, mas não foram encontrados no 3D atual.");
            }

        } catch (error) {
            console.error("Erro ao filtrar:", error);
            toast.error("Erro ao aplicar filtros.");
        } finally {
            setIsSearching(false);
        }
    };

    const clearFilters = () => {
        setFilters([{ id: 1, field: 'familia', value: '' }]);
        if (viewer) {
            const allModels = viewer.impl.modelQueue().getModels();
            allModels.forEach(model => {
                viewer.isolate(null, model); // Mostra tudo de cada modelo
                viewer.clearThemingColors(model);
            });
            viewer.fitToView();
        }
        toast.info("Filtros limpos. Visualização restaurada.");
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="p-4 border-b bg-white shadow-sm">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <FontAwesomeIcon icon={faFilter} /> Filtro Avançado
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">
                    Defina regras para isolar elementos no 3D.
                </p>
            </div>

            {/* Lista de Filtros */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filters.map((filter) => (
                    <div key={filter.id} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2 relative group">
                        
                        {/* Linha 1: Campo */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">QUEM</span>
                            <div className="flex-1 relative">
                                <input 
                                    list={`fields-${filter.id}`}
                                    placeholder="Ex: familia, status..."
                                    className="w-full text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none py-1 uppercase"
                                    value={filter.field}
                                    onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                                />
                                <datalist id={`fields-${filter.id}`}>
                                    {STANDARD_FIELDS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                    <option value="Area">Área</option>
                                    <option value="Volume">Volume</option>
                                </datalist>
                            </div>
                            {filters.length > 1 && (
                                <button onClick={() => removeRow(filter.id)} className="text-gray-300 hover:text-red-500 p-1">
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            )}
                        </div>

                        {/* Linha 2: Valor */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">IGUAL</span>
                            <div className="flex-1 relative">
                                <input 
                                    type="text"
                                    placeholder="Digite o valor..."
                                    className="w-full text-xs text-blue-600 font-medium bg-blue-50/50 border border-blue-100 rounded px-2 py-1 outline-none"
                                    value={filter.value}
                                    onChange={(e) => {
                                        updateFilter(filter.id, 'value', e.target.value);
                                        fetchSuggestions(filter.id, filter.field, e.target.value);
                                    }}
                                />
                                {activeFieldRow === filter.id && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-xl z-50 max-h-40 overflow-y-auto rounded-b-lg">
                                        {suggestions.map((sug, i) => (
                                            <div 
                                                key={i} 
                                                className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer text-gray-600 truncate border-b border-gray-50 last:border-0"
                                                onClick={() => {
                                                    updateFilter(filter.id, 'value', sug);
                                                    setSuggestions([]);
                                                    setActiveFieldRow(null);
                                                }}
                                            >
                                                {sug}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                <button 
                    onClick={addRow}
                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} /> Adicionar Regra
                </button>
            </div>

            {/* Footer */}
            <div className="p-3 border-t bg-white flex gap-2">
                <button 
                    onClick={clearFilters}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 text-xs font-bold transition-all border border-transparent hover:border-red-200"
                    title="Limpar Filtros (Mostrar Tudo)"
                >
                    <FontAwesomeIcon icon={faEyeSlash} />
                </button>
                <button 
                    onClick={applyFilters}
                    disabled={isSearching}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-md shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSearching ? <FontAwesomeIcon icon={faSearch} spin /> : <><FontAwesomeIcon icon={faMagic} /> Filtrar 3D</>}
                </button>
            </div>
        </div>
    );
}
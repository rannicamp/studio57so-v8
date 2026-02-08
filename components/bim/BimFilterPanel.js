'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faTrash, faSearch, faFilter, faTimes, faMagic, faEraser, faSpinner, faCheckDouble
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

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
    const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
    
    const [suggestions, setSuggestions] = useState([]);
    const [activeFieldRow, setActiveFieldRow] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveFieldRow(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const addRow = () => {
        const newId = filters.length > 0 ? Math.max(...filters.map(f => f.id)) + 1 : 1;
        setFilters([...filters, { id: newId, field: 'status_execucao', value: '' }]);
    };

    const removeRow = (id) => {
        const newFilters = filters.filter(f => f.id !== id);
        setFilters(newFilters);
    };

    const updateFilter = (id, key, newValue) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [key]: newValue } : f));
        if (key === 'field') setSuggestions([]);
    };

    const fetchSuggestions = async (rowId, field, searchText) => {
        setActiveFieldRow(rowId);
        setIsAutocompleteLoading(true);
        try {
            const { data, error } = await supabase
                .rpc('get_bim_field_values', {
                    p_organizacao_id: organizacao_id,
                    p_campo: field,
                    p_search: searchText || '' 
                });
            if (error) throw error;
            const cleanData = data.map(d => d.valor).filter(Boolean);
            setSuggestions(cleanData);
        } catch (error) {
            console.error("Autocomplete error:", error);
            setSuggestions([]);
        } finally {
            setIsAutocompleteLoading(false);
        }
    };

    // --- APLICAR FILTRO: VERSÃO DEFINITIVA (GHOSTING CORRETO) ---
    const applyFilters = async () => {
        if (!viewer) {
            toast.error("Visualizador 3D indisponível.");
            return;
        }

        const activeFilters = filters.filter(f => f.value && f.value.trim() !== '');
        if (activeFilters.length === 0) {
            clearFilters();
            return;
        }

        setIsSearching(true);
        try {
            // 1. Limpa tudo
            viewer.clearSelection();
            viewer.clearThemingColors();
            
            // Query no Banco
            let query = supabase.from('elementos_bim').select('external_id');
            query = query.eq('organizacao_id', organizacao_id);

            activeFilters.forEach(f => {
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
                toast.warning("Nenhum elemento encontrado.");
                viewer.showAll();
                return;
            }

            const targetExternalIds = new Set(data.map(d => d.external_id));
            let totalFound = 0;
            
            // Lista Agregada: Vai servir tanto para SELEÇÃO quanto para ISOLAMENTO
            const aggregatedList = [];
            const allDbIdsForFit = [];

            // Prepara visualização
            viewer.showAll();
            viewer.setGhosting(true);
            // Ajusta brilho do fantasma (0.1 = transparente, 0.5 = visível)
            if (viewer.impl && viewer.impl.setGhostingBrightness) {
                viewer.impl.setGhostingBrightness(0.15);
            }

            const allModels = viewer.impl.modelQueue().getModels();
            
            const searchPromises = allModels.map(model => {
                return new Promise((resolve) => {
                    model.getExternalIdMapping((mapping) => {
                        const foundDbIds = [];
                        
                        targetExternalIds.forEach(extId => {
                            if (mapping[extId]) {
                                foundDbIds.push(mapping[extId]);
                            }
                        });

                        if (foundDbIds.length > 0) {
                            totalFound += foundDbIds.length;
                            
                            // Adiciona à lista agregada (IMPORTANTE: nome da propriedade é 'ids')
                            aggregatedList.push({
                                model: model,
                                ids: foundDbIds
                            });

                            // Pinta de VERDE (Destaque Visual)
                            foundDbIds.forEach(dbId => {
                                viewer.setThemingColor(dbId, new THREE.Vector4(0, 1, 0, 0.6), model);
                                allDbIdsForFit.push(dbId);
                            });
                        }
                        // NOTA: Se o modelo não tem IDs encontrados, NÃO adicionamos à lista.
                        // Isso faz com que o aggregateIsolate trate ele como "não selecionado" -> Ghost.
                        
                        resolve();
                    });
                });
            });

            await Promise.all(searchPromises);

            if (totalFound > 0) {
                // PASSO 1: SELEÇÃO DE DADOS (Habilita troca de Status)
                if (aggregatedList.length > 0) {
                    // Seleciona apenas os itens encontrados
                    viewer.impl.selector.setAggregateSelection(aggregatedList);
                }

                // PASSO 2: ISOLAMENTO VISUAL (Ghosting Global)
                // Ao passar apenas os modelos/ids encontrados, o Viewer entende que:
                // - Itens na lista: Visíveis (Sólidos)
                // - Itens fora da lista (ou modelos inteiros fora): Fantasmas
                viewer.impl.visibilityManager.aggregateIsolate(aggregatedList);

                // PASSO 3: ZOOM
                if (allDbIdsForFit.length > 0) {
                    viewer.fitToView(allDbIdsForFit);
                }

                toast.success(`${totalFound} elementos encontrados e selecionados!`);
            } else {
                toast.warning("Elementos existem no banco, mas não nestes modelos 3D.");
            }

        } catch (error) {
            console.error("Erro filtro:", error);
            toast.error("Erro ao filtrar.");
        } finally {
            setIsSearching(false);
        }
    };

    const clearFilters = () => {
        setFilters([{ id: 1, field: 'familia', value: '' }]);
        if (viewer) {
            // aggregateIsolate([]) limpa o isolamento globalmente
            viewer.impl.visibilityManager.aggregateIsolate([]); 
            viewer.showAll();
            viewer.clearSelection(); 
            
            const allModels = viewer.impl.modelQueue().getModels();
            allModels.forEach(model => {
                viewer.clearThemingColors(model);
            });
            
            viewer.fitToView();
        }
        toast.info("Filtros limpos.");
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 font-sans" ref={dropdownRef}>
            {/* Header */}
            <div className="p-4 border-b bg-white shadow-sm flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-blue-500" /> Filtros Avançados
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        Refine e selecione para editar.
                    </p>
                </div>
                <button 
                    onClick={clearFilters}
                    className="text-gray-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1"
                    title="Limpar Tudo"
                >
                    <FontAwesomeIcon icon={faEraser} /> Limpar
                </button>
            </div>

            {/* Lista de Filtros */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {filters.map((filter, index) => (
                    <div key={filter.id} className="flex flex-col gap-1 bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative group transition-all hover:border-blue-200">
                        
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {index === 0 ? 'Regra Principal' : 'E também... (AND)'}
                            </span>
                            {filters.length > 1 && (
                                <button 
                                    onClick={() => removeRow(filter.id)} 
                                    className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                                    title="Remover regra"
                                >
                                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <label className="text-[10px] uppercase font-medium text-gray-500 mb-1 block">Campo</label>
                                <div className="relative">
                                    <input 
                                        list={`fields-${filter.id}`}
                                        placeholder="Ex: familia"
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 h-[38px] uppercase font-semibold text-gray-600"
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
                            </div>

                            <div className="relative">
                                <label className="text-[10px] uppercase font-medium text-gray-500 mb-1 block">Valor</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        placeholder="Selecione ou digite..."
                                        className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 h-[38px]"
                                        value={filter.value}
                                        onFocus={() => fetchSuggestions(filter.id, filter.field, filter.value)}
                                        onChange={(e) => {
                                            updateFilter(filter.id, 'value', e.target.value);
                                            fetchSuggestions(filter.id, filter.field, e.target.value);
                                        }}
                                    />
                                    <div className="absolute right-3 top-2.5 text-gray-400 text-xs">
                                        {isAutocompleteLoading && activeFieldRow === filter.id ? (
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                        ) : (
                                            <FontAwesomeIcon icon={faSearch} />
                                        )}
                                    </div>

                                    {activeFieldRow === filter.id && suggestions.length > 0 && (
                                        <ul className="absolute z-20 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 animate-in fade-in zoom-in-95 duration-100">
                                            {suggestions.map((sug, i) => (
                                                <li 
                                                    key={i} 
                                                    onClick={() => {
                                                        updateFilter(filter.id, 'value', sug);
                                                        setSuggestions([]);
                                                        setActiveFieldRow(null);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer text-xs text-gray-700 border-b border-gray-50 last:border-0 flex items-center justify-between group"
                                                >
                                                    <HighlightedText text={sug} highlight={filter.value} />
                                                    {filter.value === sug && <FontAwesomeIcon icon={faCheckDouble} className="text-blue-500 text-[10px]"/>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    
                                    {activeFieldRow === filter.id && !isAutocompleteLoading && suggestions.length === 0 && filter.value.length > 0 && (
                                         <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg p-2 mt-1 text-center">
                                            <span className="text-xs text-gray-400 italic">Nenhuma sugestão encontrada.</span>
                                         </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                ))}

                <button 
                    onClick={addRow}
                    className="w-full py-2.5 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} /> ADICIONAR REGRA
                </button>
            </div>

            <div className="p-3 border-t bg-white">
                <button 
                    onClick={applyFilters}
                    disabled={isSearching}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-md shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSearching ? <><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</> : <><FontAwesomeIcon icon={faMagic} /> Aplicar e Selecionar</>}
                </button>
            </div>
        </div>
    );
}
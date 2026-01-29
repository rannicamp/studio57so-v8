'use client';

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faTrash, faSearch, faFilter, faTimes, faMagic, faEraser 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Campos padrão do banco (Colunas reais)
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
        
        // Se mudou o campo, limpa o valor e sugestões
        if (key === 'field') {
            setSuggestions([]);
        }
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

    // --- APLICAR O FILTRO (A Mágica Visual) ---
    const applyFilters = async () => {
        if (!viewer) {
            toast.error("Visualizador não carregado.");
            return;
        }

        setIsSearching(true);
        try {
            // 1. Monta a Query Dinâmica no Supabase
            let query = supabase.from('elementos_bim').select('external_id');
            
            // Filtra pela organização sempre
            query = query.eq('organizacao_id', organizacao_id);

            // Adiciona cada linha de filtro (Lógica AND)
            filters.forEach(f => {
                if (!f.value) return;

                // Verifica se é coluna padrão ou JSON
                const isStandard = STANDARD_FIELDS.some(sf => sf.value === f.field);
                
                if (isStandard) {
                    // Coluna normal (ex: familia = 'Parede')
                    query = query.ilike(f.field, `%${f.value}%`);
                } else {
                    // JSON Property (ex: propriedades->>'Area' = '20')
                    // O operador ->> extrai como texto
                    query = query.ilike(`propriedades->>${f.field}`, `%${f.value}%`);
                }
            });

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.warning("Nenhum elemento encontrado com esses critérios.");
                viewer.showAll();
                viewer.clearSelection();
                return;
            }

            // 2. Aplica no Visualizador
            const ids = data.map(d => d.external_id);
            
            // Busca os dbIds (Identificadores internos do Viewer) baseados nos externalIds
            // Isso requer mapeamento, mas como atalho vamos isolar via fitToView se possível
            // NOTA: O viewer precisa dos dbIds, não externalIds. 
            // Vamos fazer o mapeamento reverso.
            
            viewer.search(data[0].external_id, (dbIds) => {
                 // Essa busca simples do viewer é lenta ID por ID.
                 // A estratégia correta para muitos itens é usar BulkProperties no load, 
                 // mas aqui vamos usar um truque visual:
                 // Vamos colorir tudo de transparente e os encontrados de azul?
                 // Melhor: Isolar.
            }, null, ['externalId']);

            // Mapeamento Robusto: ExternalID -> DbID
            const model = viewer.model; 
            if (model) {
                model.getExternalIdMapping((mapping) => {
                    const dbIdsToIsolate = [];
                    ids.forEach(extId => {
                        if (mapping[extId]) dbIdsToIsolate.push(mapping[extId]);
                    });

                    if (dbIdsToIsolate.length > 0) {
                        viewer.isolate(dbIdsToIsolate);
                        viewer.fitToView(dbIdsToIsolate);
                        // Opcional: Pintar de azul para destacar
                        viewer.clearThemingColors();
                        dbIdsToIsolate.forEach(id => {
                            viewer.setThemingColor(id, new THREE.Vector4(0, 0.5, 1, 0.5));
                        });
                        
                        toast.success(`${dbIdsToIsolate.length} elementos filtrados!`);
                    } else {
                        toast.warning("Elementos encontrados no banco, mas não neste modelo 3D.");
                    }
                });
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
            viewer.isolate(null); // Mostra tudo
            viewer.showAll();
            viewer.clearThemingColors();
            viewer.fitToView();
        }
        toast.info("Filtros limpos.");
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="p-4 border-b bg-white shadow-sm">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <FontAwesomeIcon icon={faFilter} /> Filtro Avançado
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">
                    Combine regras para encontrar elementos específicos.
                </p>
            </div>

            {/* Lista de Filtros */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filters.map((filter, index) => (
                    <div key={filter.id} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2 relative group">
                        
                        {/* Linha 1: Seletor de Campo */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">QUEM</span>
                            <div className="flex-1 relative">
                                <input 
                                    list={`fields-${filter.id}`}
                                    placeholder="Ex: familia, tipo, Area..."
                                    className="w-full text-xs font-bold text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none py-1"
                                    value={filter.field}
                                    onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                                />
                                <datalist id={`fields-${filter.id}`}>
                                    {STANDARD_FIELDS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                    <option value="Area">Propriedade: Área</option>
                                    <option value="Volume">Propriedade: Volume</option>
                                    <option value="Length">Propriedade: Comprimento</option>
                                </datalist>
                            </div>
                            
                            {/* Botão Remover (Só aparece se tiver mais de 1 linha) */}
                            {filters.length > 1 && (
                                <button onClick={() => removeRow(filter.id)} className="text-gray-300 hover:text-red-500 p-1">
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            )}
                        </div>

                        {/* Linha 2: Valor (com Autocomplete) */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 w-8">IGUAL</span>
                            <div className="flex-1 relative">
                                <input 
                                    type="text"
                                    placeholder="Digite para buscar..."
                                    className="w-full text-xs text-blue-600 font-medium bg-blue-50/50 border border-blue-100 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300"
                                    value={filter.value}
                                    onChange={(e) => {
                                        updateFilter(filter.id, 'value', e.target.value);
                                        fetchSuggestions(filter.id, filter.field, e.target.value);
                                    }}
                                />
                                {/* Dropdown de Sugestões */}
                                {activeFieldRow === filter.id && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-xl z-50 max-h-40 overflow-y-auto rounded-b-lg">
                                        {suggestions.map((sug, i) => (
                                            <div 
                                                key={i} 
                                                className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer text-gray-600 truncate"
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

                {/* Botão Adicionar Linha */}
                <button 
                    onClick={addRow}
                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} /> Adicionar Regra
                </button>
            </div>

            {/* Footer de Ações */}
            <div className="p-3 border-t bg-white flex gap-2">
                <button 
                    onClick={clearFilters}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold transition-all"
                    title="Limpar Filtros"
                >
                    <FontAwesomeIcon icon={faEraser} />
                </button>
                <button 
                    onClick={applyFilters}
                    disabled={isSearching}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold shadow-md shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSearching ? (
                        <><FontAwesomeIcon icon={faSearch} spin /> Buscando...</>
                    ) : (
                        <><FontAwesomeIcon icon={faMagic} /> Aplicar Filtro</>
                    )}
                </button>
            </div>
        </div>
    );
}
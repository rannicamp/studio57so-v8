'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faTrash, faSearch, faFilter, faTimes, faMagic, faEraser, faSpinner, faCheckDouble, faSliders
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const HighlightedText = ({ text = '', highlight = '' }) => {
  if (!highlight.trim() || !text) { return <span>{text}</span>; }
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => regex.test(part) ? (
        <mark key={i} className="bg-yellow-250 px-0.5 rounded font-bold">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      ))}
    </span>
  );
};

const STANDARD_FIELDS = [
  { value: 'categoria', label: 'Categoria' },
  { value: 'familia', label: 'Família' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'nivel', label: 'Nível' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'status_execucao', label: 'Status' }
];

export default function BimFilterPanel({ viewer, projetoBimId }) {
  const supabase = createClient();
  const { organizacao_id } = useAuth();
  
  const [filters, setFilters] = useState([
    { id: 1, field: 'categoria', value: '' }
  ]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  // Controle de popups de sugestão (por linha de filtro)
  const [activeFieldRow, setActiveFieldRow] = useState(null); // Autocomplete de Valores
  const [activeFieldRowSuggestions, setActiveFieldRowSuggestions] = useState(null); // Autocomplete de Campos
  const [fieldSuggestions, setFieldSuggestions] = useState([]); // Lista filtrada de campos
  
  const dropdownRef = useRef(null);

  // Fecha todos os dropdowns de sugestão ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFieldRow(null);
        setActiveFieldRowSuggestions(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Query reativa para buscar as propriedades reais do projeto BIM ativo
  const { data: projectProperties = [], isFetching: carregandoPropriedades } = useQuery({
    queryKey: ['bim_project_properties', organizacao_id, projetoBimId],
    queryFn: async () => {
      if (!projetoBimId || !organizacao_id) return [];
      const { data, error } = await supabase.rpc('get_bim_project_properties', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_bim_id: Number(projetoBimId)
      });
      if (error) {
        console.error('[BimFilterPanel] Erro ao carregar propriedades do projeto:', error);
        throw error;
      }
      return data?.map(d => d.nome_propriedade) || [];
    },
    enabled: !!projetoBimId && !!organizacao_id,
    staleTime: 5 * 60 * 1000 // Cache de 5 minutos
  });

  const addRow = () => {
    const newId = filters.length > 0 ? Math.max(...filters.map(f => f.id)) + 1 : 1;
    // Sugere por padrão o próximo campo mais lógico ou família
    const camposUsados = filters.map(f => f.field);
    let defaultField = 'familia';
    if (camposUsados.includes('categoria') && !camposUsados.includes('familia')) defaultField = 'familia';
    else if (camposUsados.includes('familia') && !camposUsados.includes('tipo')) defaultField = 'tipo';
    else if (camposUsados.includes('tipo') && !camposUsados.includes('nivel')) defaultField = 'nivel';

    setFilters([...filters, { id: newId, field: defaultField, value: '' }]);
  };

  const removeRow = (id) => {
    const newFilters = filters.filter(f => f.id !== id);
    setFilters(newFilters);
  };

  const updateFilter = (id, key, newValue) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [key]: newValue } : f));
    if (key === 'field') {
      // Reseta o valor correspondente ao mudar o campo para não gerar lixo
      setFilters(filters.map(f => f.id === id ? { ...f, field: newValue, value: '' } : f));
      setSuggestions([]);
    }
  };

  // Aciona a listagem de sugestões de campos
  const handleFieldFocus = (rowId, searchText) => {
    setActiveFieldRow(rowId); // Fecha valor
    setActiveFieldRowSuggestions(rowId);
    
    const allCandidateFields = [
      ...STANDARD_FIELDS.map(sf => sf.value),
      ...projectProperties
    ];
    
    const term = (searchText || '').toLowerCase();
    const filtered = allCandidateFields.filter(f => 
      f.toLowerCase().includes(term)
    );
    setFieldSuggestions(filtered);
  };

  // Autocomplete de Valores em Cascata Inteligente (com filtros acumulados)
  const fetchSuggestions = async (rowId, field, searchText) => {
    if (!field || field.trim() === '') return;
    
    setActiveFieldRowSuggestions(null); // Fecha campo
    setActiveFieldRow(rowId);
    setIsAutocompleteLoading(true);
    
    try {
      // Agrupa todas as outras regras preenchidas em um objeto key-value
      const activeFiltersObj = {};
      filters.forEach(f => {
        if (f.id !== rowId && f.field && f.value && f.value.trim() !== '') {
          activeFiltersObj[f.field] = f.value.trim();
        }
      });

      const { data, error } = await supabase.rpc('get_bim_field_values', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_bim_id: Number(projetoBimId),
        p_campo: field,
        p_search: searchText || '',
        p_filtros_ativos: activeFiltersObj
      });

      if (error) throw error;
      const cleanData = data?.map(d => d.valor).filter(Boolean) || [];
      setSuggestions(cleanData);
    } catch (error) {
      console.error("[BimFilterPanel] Erro ao buscar autocompleta de valores:", error);
      setSuggestions([]);
    } finally {
      setIsAutocompleteLoading(false);
    }
  };

  // Aplicar filtros com restrição ao projeto BIM ativo e isolamento visual por Ghosting
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
      viewer.clearSelection();
      viewer.clearThemingColors();

      // Monta consulta SQL com restrição obrigatória ao projeto BIM ativo
      let query = supabase.from('elementos_bim').select('external_id');
      query = query.eq('organizacao_id', Number(organizacao_id));
      query = query.eq('projeto_bim_id', Number(projetoBimId));

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
        toast.warning("Nenhum elemento correspondente encontrado.");
        viewer.showAll();
        return;
      }

      const targetExternalIds = new Set(data.map(d => d.external_id));
      let totalFound = 0;
      const aggregatedList = [];
      const allDbIdsForFit = [];

      viewer.showAll();
      viewer.setGhosting(true);
      if (viewer.impl && viewer.impl.setGhostingBrightness) {
        viewer.impl.setGhostingBrightness(0.12); // Elementos fantasmas discretos
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
              aggregatedList.push({
                model: model,
                ids: foundDbIds
              });

              // Destaca visualmente em verde as peças filtradas
              foundDbIds.forEach(dbId => {
                viewer.setThemingColor(dbId, new THREE.Vector4(0.1, 0.8, 0.1, 0.5), model);
                allDbIdsForFit.push(dbId);
              });
            }
            resolve();
          });
        });
      });

      await Promise.all(searchPromises);

      if (totalFound > 0) {
        if (aggregatedList.length > 0) {
          viewer.impl.selector.setAggregateSelection(aggregatedList);
        }
        // Aplica o isolamento visual nativo (deixando os outros translúcidos)
        viewer.impl.visibilityManager.aggregateIsolate(aggregatedList);

        if (allDbIdsForFit.length > 0) {
          viewer.fitToView(allDbIdsForFit);
        }

        toast.success(`${totalFound} elementos encontrados e destacados!`);
      } else {
        toast.warning("Elementos localizados no banco, mas ausentes nos modelos carregados.");
      }
    } catch (error) {
      console.error("[BimFilterPanel] Erro ao aplicar filtros no visualizador:", error);
      toast.error("Ocorreu uma falha ao realizar a filtragem.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearFilters = () => {
    setFilters([{ id: 1, field: 'categoria', value: '' }]);
    if (viewer) {
      viewer.impl.visibilityManager.aggregateIsolate([]); 
      viewer.showAll();
      viewer.clearSelection(); 
      const allModels = viewer.impl.modelQueue().getModels();
      allModels.forEach(model => {
        viewer.clearThemingColors(model);
      });
      viewer.fitToView();
    }
    toast.info("Todos os filtros foram limpos.");
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50 font-sans" ref={dropdownRef}>
      
      {/* Header */}
      <div className="p-4 border-b bg-white shadow-sm flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FontAwesomeIcon icon={faSliders} className="text-slate-800" /> Filtros Avançados
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Crie regras inteligentes para isolar peças.
          </p>
        </div>
        <button 
          onClick={clearFilters}
          className="text-gray-400 hover:text-red-600 transition-colors text-xs flex items-center gap-1 font-semibold"
          title="Limpar Tudo"
        >
          <FontAwesomeIcon icon={faEraser} /> Limpar
        </button>
      </div>

      {/* Lista de Filtros Dinâmicos */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {filters.map((filter, index) => {
          // Resolve label de exibição do campo ativo
          const std = STANDARD_FIELDS.find(sf => sf.value === filter.field);
          const activeFieldName = std ? std.label : filter.field;

          return (
            <div 
              key={filter.id} 
              className="flex flex-col gap-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm relative transition-all hover:border-slate-350"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {index === 0 ? 'Filtro Principal' : 'Adicional (AND)'}
                </span>
                {filters.length > 1 && (
                  <button 
                    onClick={() => removeRow(filter.id)} 
                    className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                    title="Remover esta regra"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Campo */}
                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">Parâmetro / Propriedade</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Ex: familia ou Nivel..."
                      className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-800 focus:border-slate-800 outline-none h-[36px] font-semibold text-slate-700"
                      value={filter.field}
                      onFocus={(e) => handleFieldFocus(filter.id, e.target.value)}
                      onChange={(e) => {
                        updateFilter(filter.id, 'field', e.target.value);
                        handleFieldFocus(filter.id, e.target.value);
                      }}
                    />
                    <div className="absolute right-3 top-2.5 text-gray-300 text-[10px]">
                      {carregandoPropriedades ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <FontAwesomeIcon icon={faFilter} />
                      )}
                    </div>

                    {/* Autocomplete de Nomes de Campos */}
                    {activeFieldRowSuggestions === filter.id && fieldSuggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1 animate-in fade-in zoom-in-95 duration-100 p-1">
                        {fieldSuggestions.map((sugField, i) => {
                          const isStd = STANDARD_FIELDS.find(sf => sf.value === sugField);
                          const label = isStd ? isStd.label : sugField;
                          
                          return (
                            <li 
                              key={i} 
                              onClick={() => {
                                updateFilter(filter.id, 'field', sugField);
                                setFieldSuggestions([]);
                                setActiveFieldRowSuggestions(null);
                              }}
                              className="p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-gray-700 border-b border-gray-50 last:border-0 flex items-center justify-between font-semibold"
                            >
                              <span>{label}</span>
                              <span className={`text-[8px] uppercase px-1.5 py-0.2 rounded font-bold ${
                                isStd ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {isStd ? 'Padrão' : 'Custom'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <div className="relative">
                  <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">
                    Valor de {activeFieldName || 'Campo'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Selecione ou digite..."
                      className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-800 focus:border-slate-800 outline-none h-[36px]"
                      value={filter.value}
                      onFocus={() => fetchSuggestions(filter.id, filter.field, filter.value)}
                      onChange={(e) => {
                        updateFilter(filter.id, 'value', e.target.value);
                        fetchSuggestions(filter.id, filter.field, e.target.value);
                      }}
                    />
                    <div className="absolute right-3 top-2.5 text-gray-300 text-xs">
                      {isAutocompleteLoading && activeFieldRow === filter.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <FontAwesomeIcon icon={faSearch} />
                      )}
                    </div>

                    {/* Autocomplete de Valores */}
                    {activeFieldRow === filter.id && suggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1 animate-in fade-in zoom-in-95 duration-100 p-1">
                        {suggestions.map((sug, i) => (
                          <li 
                            key={i} 
                            onClick={() => {
                              updateFilter(filter.id, 'value', sug);
                              setSuggestions([]);
                              setActiveFieldRow(null);
                            }}
                            className="p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-gray-700 border-b border-gray-50 last:border-0 flex items-center justify-between font-semibold"
                          >
                            <HighlightedText text={sug} highlight={filter.value} />
                            {filter.value === sug && (
                              <FontAwesomeIcon icon={faCheckDouble} className="text-blue-500 text-[10px]"/>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {/* Feedback quando não há resultados */}
                    {activeFieldRow === filter.id && !isAutocompleteLoading && suggestions.length === 0 && filter.value.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 mt-1 text-center">
                        <span className="text-[11px] text-gray-400 italic font-semibold">Sem resultados encontrados.</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}

        <button 
          onClick={addRow}
          className="w-full py-2.5 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-slate-800 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} /> ADICIONAR REGRA
        </button>
      </div>

      {/* Ação de Aplicar */}
      <div className="p-3 border-t bg-white shrink-0">
        <button 
          onClick={applyFilters}
          disabled={isSearching}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-slate-200"
        >
          {isSearching ? (
            <><FontAwesomeIcon icon={faSpinner} spin /> Filtrando...</>
          ) : (
            <><FontAwesomeIcon icon={faMagic} /> Aplicar e Selecionar</>
          )}
        </button>
      </div>

    </div>
  );
}
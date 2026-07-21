'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, faTrash, faSearch, faFilter, faTimes, faMagic, faEraser, faSpinner, faCheckDouble, faSliders, faChevronDown
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

// Mapeamento de tipos de regras padrões e seus labels amigáveis
const FILTER_TYPES = [
  { value: 'categoria', label: 'Categoria' },
  { value: 'familia', label: 'Família' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'nivel', label: 'Nível' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'status', label: 'Status' },
  { value: 'custom', label: 'Propriedade Customizada (Parâmetro)...' }
];

const STANDARD_FIELDS = ['familia', 'tipo', 'categoria', 'nivel', 'status_execucao', 'sistema'];

export default function BimFilterPanel({ viewer, projetoBimId, loadedProjectIds = [], onFilterApplied, onFilterCleared }) {
  const supabase = createClient();
  const { organizacao_id } = useAuth();
  
  // Estado inicial das regras em formato estruturado
  const [filters, setFilters] = useState([
    { id: 1, type: 'categoria', customField: '', value: '' }
  ]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  // Controles de exibição de popups de sugestão (por ID de linha da regra)
  const [activeFieldRow, setActiveFieldRow] = useState(null); // Autocomplete de Valores
  const [activeFieldRowSuggestions, setActiveFieldRowSuggestions] = useState(null); // Autocomplete de Parâmetros Customizados
  const [fieldSuggestions, setFieldSuggestions] = useState([]); // Lista filtrada de parâmetros do projeto
  
  const dropdownRef = useRef(null);

  // Fecha dropdowns de sugestão quando o usuário clica fora
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

  // Query reativa para buscar todos os parâmetros reais do projeto BIM ativo
  const { data: projectProperties = [], isFetching: carregandoPropriedades } = useQuery({
    queryKey: ['bim_project_properties', organizacao_id, projetoBimId, [...loadedProjectIds].sort().join(',')],
    queryFn: async () => {
      if (!projetoBimId || !organizacao_id) return [];
      const ids = loadedProjectIds && loadedProjectIds.length > 0 ? loadedProjectIds : [projetoBimId];
      const { data, error } = await supabase.rpc('get_bim_project_properties_v2', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_ids: ids.map(Number)
      });
      if (error) {
        console.error('[BimFilterPanel] Erro ao carregar parâmetros do projeto:', error);
        throw error;
      }
      return data?.map(d => d.nome_propriedade) || [];
    },
    enabled: !!projetoBimId && !!organizacao_id,
    staleTime: 5 * 60 * 1000 // Cache de 5 minutos
  });

  const addRow = () => {
    const newId = filters.length > 0 ? Math.max(...filters.map(f => f.id)) + 1 : 1;
    // Tenta prever a próxima seleção mais lógica baseada no que já foi selecionado
    const tiposUsados = filters.map(f => f.type);
    let defaultType = 'familia';
    if (tiposUsados.includes('categoria') && !tiposUsados.includes('familia')) defaultType = 'familia';
    else if (tiposUsados.includes('familia') && !tiposUsados.includes('tipo')) defaultType = 'tipo';
    else if (tiposUsados.includes('tipo') && !tiposUsados.includes('nivel')) defaultType = 'nivel';

    setFilters([...filters, { id: newId, type: defaultType, customField: '', value: '' }]);
  };

  const removeRow = (id) => {
    const newFilters = filters.filter(f => f.id !== id);
    setFilters(newFilters);
  };

  const updateFilter = (id, key, newValue) => {
    setFilters(filters.map(f => {
      if (f.id === id) {
        const updated = { ...f, [key]: newValue };
        // Se mudou o tipo de filtro, zera o parâmetro customizado e o valor para evitar lixo
        if (key === 'type') {
          updated.customField = '';
          updated.value = '';
        }
        return updated;
      }
      return f;
    }));
    setSuggestions([]);
  };

  // Abre e carrega a listagem de parâmetros customizados (Nível 2)
  const handleCustomFieldFocus = (rowId, searchText) => {
    setActiveFieldRow(null); // Fecha popup de valor
    setActiveFieldRowSuggestions(rowId);
    
    const term = (searchText || '').toLowerCase();
    const filtered = projectProperties.filter(p => 
      p.toLowerCase().includes(term)
    );
    setFieldSuggestions(filtered);
  };

  // Autocomplete de Valores em Cascata Inteligente (Nível 3)
  const fetchSuggestions = async (rowId, filterItem, searchText) => {
    // Determina o nome do campo real de banco de dados
    let targetField = '';
    if (filterItem.type === 'custom') {
      targetField = filterItem.customField;
    } else {
      targetField = filterItem.type === 'status' ? 'status_execucao' : filterItem.type;
    }

    if (!targetField || targetField.trim() === '') return;
    
    setActiveFieldRowSuggestions(null); // Fecha popup de campo
    setActiveFieldRow(rowId);
    setIsAutocompleteLoading(true);
    
    try {
      // Monta os filtros de outras linhas como um objeto key-value
      const activeFiltersObj = {};
      filters.forEach(f => {
        if (f.id !== rowId && f.value && f.value.trim() !== '') {
          if (f.type === 'custom') {
            if (f.customField && f.customField.trim() !== '') {
              activeFiltersObj[f.customField.trim()] = f.value.trim();
            }
          } else {
            const dbField = f.type === 'status' ? 'status_execucao' : f.type;
            activeFiltersObj[dbField] = f.value.trim();
          }
        }
      });

      const ids = loadedProjectIds && loadedProjectIds.length > 0 ? loadedProjectIds : [projetoBimId];
      const { data, error } = await supabase.rpc('get_bim_field_values_v2', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_ids: ids.map(Number),
        p_campo: targetField,
        p_search: searchText || '',
        p_filtros_ativos: activeFiltersObj
      });

      if (error) throw error;
      const cleanData = data?.map(d => d.valor).filter(Boolean) || [];
      setSuggestions(cleanData);
    } catch (error) {
      console.error("[BimFilterPanel] Erro ao carregar sugestões de valores:", error);
      setSuggestions([]);
    } finally {
      setIsAutocompleteLoading(false);
    }
  };

  // Aplicar filtros com restrição ao projeto BIM ativo e isolamento visual por Ghosting
  const applyFilters = async () => {
    const activeFilters = filters.filter(f => {
      if (f.type === 'custom') {
        return f.customField && f.customField.trim() !== '' && f.value && f.value.trim() !== '';
      }
      return f.value && f.value.trim() !== '';
    });

    if (activeFilters.length === 0) {
      clearFilters();
      return;
    }

    setIsSearching(true);
    try {
      if (viewer) {
        viewer.clearSelection();
        viewer.clearThemingColors();
      }

      // Monta consulta SQL restringindo aos projetos BIM ativos (apenas colunas nativas do banco)
      let query = supabase.from('elementos_bim').select('id, external_id, categoria, familia, tipo, nivel, status_execucao, propriedades');
      query = query.eq('organizacao_id', Number(organizacao_id));
      query = query.eq('is_active', true);
      
      const rawIds = loadedProjectIds && loadedProjectIds.length > 0 ? loadedProjectIds : [projetoBimId];
      const ids = rawIds.map(Number).filter(id => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        query = query.in('projeto_bim_id', ids);
      }

      const STD_FIELDS_MAP = {
        'categoria': 'categoria',
        'familia': 'familia',
        'família': 'familia',
        'tipo': 'tipo',
        'nivel': 'nivel',
        'nível': 'nivel',
        'status': 'status_execucao',
        'status_execucao': 'status_execucao'
      };

      activeFilters.forEach(f => {
        let targetField = '';
        let isStandard = false;
        let stdCol = '';

        if (f.type === 'custom') {
          targetField = (f.customField || '').trim();
          const lowerKey = targetField.toLowerCase();
          if (STD_FIELDS_MAP[lowerKey]) {
            isStandard = true;
            stdCol = STD_FIELDS_MAP[lowerKey];
          }
        } else if (f.type === 'sistema') {
          targetField = 'sistema';
          isStandard = false;
        } else {
          const typeKey = f.type === 'status' ? 'status_execucao' : f.type;
          const lowerKey = typeKey.toLowerCase();
          if (STD_FIELDS_MAP[lowerKey]) {
            isStandard = true;
            stdCol = STD_FIELDS_MAP[lowerKey];
          } else {
            targetField = typeKey;
          }
        }

        if (isStandard && stdCol) {
          query = query.ilike(stdCol, `%${f.value.trim()}%`);
        } else if (targetField) {
          query = query.ilike(`propriedades->>${targetField}`, `%${f.value.trim()}%`);
        }
      });

      const { data, error } = await query;
      if (error) throw error;

      // Dispara o callback para atualizar a tabela de Elementos BIM do Orçamento
      if (onFilterApplied) {
        onFilterApplied(data || [], activeFilters);
      }

      if (!data || data.length === 0) {
        toast.warning("Nenhum elemento correspondente encontrado.");
        if (viewer) viewer.showAll();
        return;
      }

      if (!viewer) {
        toast.success(`${data.length} elemento(s) localizado(s) no banco!`);
        return;
      }

      const targetExternalIds = new Set(data.map(d => d.external_id));
      let totalFound = 0;
      const aggregatedList = [];
      const allDbIdsForFit = [];

      viewer.showAll();
      viewer.setGhosting(true);
      if (viewer.impl && viewer.impl.setGhostingBrightness) {
        viewer.impl.setGhostingBrightness(0.12);
      }

      const extrairSufixoRevit = (id) => {
        if (!id) return null;
        const partes = String(id).split(/[-/\\:_]/);
        if (partes.length > 0) {
          const ultimo = partes[partes.length - 1];
          if (ultimo && ultimo.match(/^[0-9a-fA-F]+$/)) {
            return ultimo.toLowerCase();
          }
        }
        return null;
      };

      const allModels = viewer.impl.modelQueue().getModels();
      const searchPromises = allModels.map(model => {
        return new Promise((resolve) => {
          model.getExternalIdMapping((mapping) => {
            if (!mapping) {
              resolve();
              return;
            }

            const foundDbIds = [];
            let lowercaseMap = null;
            let sufixoMap = null;

            targetExternalIds.forEach(eid => {
              const cleanEid = String(eid).trim();
              
              // 1. Match exato
              if (mapping[cleanEid] !== undefined) {
                foundDbIds.push(mapping[cleanEid]);
              } else {
                // 2. Match case-insensitive
                if (!lowercaseMap) {
                  lowercaseMap = {};
                  for (const key in mapping) {
                    lowercaseMap[key.toLowerCase()] = mapping[key];
                  }
                }
                const lowerEid = cleanEid.toLowerCase();
                if (lowercaseMap[lowerEid] !== undefined) {
                  foundDbIds.push(lowercaseMap[lowerEid]);
                } else {
                  // 3. Match por sufixo Revit
                  const sufixoEid = extrairSufixoRevit(cleanEid);
                  if (sufixoEid) {
                    if (!sufixoMap) {
                      sufixoMap = {};
                      for (const key in mapping) {
                        const suf = extrairSufixoRevit(key);
                        if (suf) sufixoMap[suf] = mapping[key];
                      }
                    }
                    if (sufixoMap[sufixoEid] !== undefined) {
                      foundDbIds.push(sufixoMap[sufixoEid]);
                    }
                  }
                }
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

        toast.success(`${totalFound} elementos destacados no modelo!`);
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
    setFilters([{ id: 1, type: 'categoria', customField: '', value: '' }]);
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
    if (onFilterCleared) {
      onFilterCleared();
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
            Monte regras em camadas para isolar peças.
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
          const isCustom = filter.type === 'custom';

          return (
            <div 
              key={filter.id} 
              className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative transition-all hover:border-slate-350"
            >
              {/* Topo da linha com remoção */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
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

              <div className="flex flex-col gap-2.5">
                
                {/* Camada 1: Tipo de Filtro (Dropdown Fixo) */}
                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">1. Filtrar por</label>
                  <div className="relative">
                    <select
                      value={filter.type}
                      onChange={(e) => updateFilter(filter.id, 'type', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-slate-800 focus:border-slate-800 outline-none h-[36px] appearance-none"
                    >
                      {FILTER_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-3 text-slate-400 text-[10px] pointer-events-none">
                      <FontAwesomeIcon icon={faChevronDown} />
                    </div>
                  </div>
                </div>

                {/* Camada 2: Seleção do Parâmetro Customizado (Condicional) */}
                {isCustom && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">2. Nome do Parâmetro</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Ex: Espessura, Volume, Área..."
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-800 focus:border-slate-800 outline-none h-[36px] font-semibold text-slate-700"
                        value={filter.customField}
                        onFocus={(e) => handleCustomFieldFocus(filter.id, e.target.value)}
                        onChange={(e) => {
                          updateFilter(filter.id, 'customField', e.target.value);
                          handleCustomFieldFocus(filter.id, e.target.value);
                        }}
                      />
                      <div className="absolute right-3 top-2.5 text-gray-300 text-[10px]">
                        {carregandoPropriedades ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faFilter} />
                        )}
                      </div>

                      {/* Autocomplete de Parâmetros Customizados */}
                      {activeFieldRowSuggestions === filter.id && fieldSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1 animate-in fade-in zoom-in-95 duration-100 p-1">
                          {fieldSuggestions.map((sugField, i) => (
                            <li 
                              key={i} 
                              onClick={() => {
                                updateFilter(filter.id, 'customField', sugField);
                                setFieldSuggestions([]);
                                setActiveFieldRowSuggestions(null);
                              }}
                              className="p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-gray-700 border-b border-gray-50 last:border-0 flex items-center justify-between font-semibold"
                            >
                              <span>{sugField}</span>
                              <span className="text-[8px] uppercase px-1.5 py-0.2 rounded font-bold bg-blue-50 text-blue-600">
                                Custom
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* Camada 3: Valor (Autocomplete) */}
                <div className="relative">
                  <label className="text-[9px] uppercase font-bold text-gray-400 mb-1 block">
                    {isCustom ? '3. Valor do Parâmetro' : '2. Valor'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Selecione ou digite..."
                      className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-800 focus:border-slate-800 outline-none h-[36px]"
                      value={filter.value}
                      onFocus={() => fetchSuggestions(filter.id, filter, filter.value)}
                      onChange={(e) => {
                        updateFilter(filter.id, 'value', e.target.value);
                        fetchSuggestions(filter.id, filter, e.target.value);
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

      {/* Botão de Ação de Filtrar */}
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
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilter, faPlus, faTrash, faChevronUp, faChevronDown, faUndo, faSearch,
  faSliders, faTimes, faCheck, faInfoCircle, faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const FILTER_TYPES = [
  { value: 'categoria', label: 'Categoria' },
  { value: 'familia', label: 'Família' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'nivel', label: 'Nível / Pavimento' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'status', label: 'Status de Execução' },
  { value: 'custom', label: 'Propriedade Customizada (Parâmetro)...' }
];

const OPERATORS = [
  { value: 'contains', label: 'Contém' },
  { value: 'equals', label: 'Igual a' },
  { value: 'gte', label: '>= Maior ou igual' },
  { value: 'lte', label: '<= Menor ou igual' }
];

export default function BimFiltroAvancadoDrawer({
  isExpanded,
  setIsExpanded,
  regrasFiltro,
  setRegrasFiltro,
  categoriaFiltro,
  setCategoriaFiltro,
  apenasNaoMapeados,
  setApenasNaoMapeados,
  listaCategoriasUnicas = [],
  propriedadesDisponiveis = [],
  modelosSelecionadosIds = [],
  totalResultados = 0,
  onLimparTudo
}) {
  const supabase = createClient();
  const { organizacao_id } = useAuth();

  const [autocompleteFieldRow, setAutocompleteFieldRow] = useState(null);
  const [autocompleteValueRow, setAutocompleteValueRow] = useState(null);
  const [valorSugestoes, setValorSugestoes] = useState([]);
  const [carregandoValores, setCarregandoValores] = useState(false);
  const dropdownRef = useRef(null);

  // Query reativa para buscar todos os parâmetros reais do projeto BIM ativo via RPC
  const { data: projectPropertiesRpc = [] } = useQuery({
    queryKey: ['bim_project_properties_drawer', organizacao_id, [...modelosSelecionadosIds].sort().join(',')],
    queryFn: async () => {
      if (!modelosSelecionadosIds || modelosSelecionadosIds.length === 0 || !organizacao_id) return [];
      const { data, error } = await supabase.rpc('get_bim_project_properties_v2', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_ids: modelosSelecionadosIds.map(Number)
      });
      if (error) throw error;
      return data?.map(d => d.nome_propriedade || d) || [];
    },
    enabled: modelosSelecionadosIds.length > 0 && !!organizacao_id,
    staleTime: 5 * 60 * 1000
  });

  const todasPropriedades = useMemo(() => {
    const setProps = new Set([...projectPropertiesRpc, ...propriedadesDisponiveis, 'DN', 'Seção_b', 'Seção_h', 'Comprimento', 'Área', 'Volume', 'Nível', 'Material', 'Fabricante', 'Dimensões', 'Tamanho']);
    return Array.from(setProps).sort();
  }, [projectPropertiesRpc, propriedadesDisponiveis]);

  // Função para buscar valores via RPC get_bim_field_values_v2
  const buscarValoresPropriedade = async (rowId, campo, termoBusca) => {
    if (!campo || !organizacao_id || modelosSelecionadosIds.length === 0) return;
    setAutocompleteValueRow(rowId);
    setCarregandoValores(true);
    try {
      const activeFiltersObj = {};
      regrasFiltro.forEach(r => {
        if (r.id !== rowId && r.value && r.value.trim()) {
          const key = r.type === 'custom' ? r.customField : (r.type === 'status' ? 'status_execucao' : r.type);
          if (key) activeFiltersObj[key] = r.value.trim();
        }
      });

      const { data, error } = await supabase.rpc('get_bim_field_values_v2', {
        p_organizacao_id: Number(organizacao_id),
        p_projeto_ids: modelosSelecionadosIds.map(Number),
        p_campo: campo,
        p_search: termoBusca || '',
        p_filtros_ativos: activeFiltersObj
      });

      if (error) throw error;
      setValorSugestoes(data?.map(d => d.valor).filter(Boolean) || []);
    } catch (e) {
      console.warn('[FiltroDrawer] Erro ao carregar valores da RPC:', e);
      setValorSugestoes([]);
    } finally {
      setCarregandoValores(false);
    }
  };

  // Fecha popups de autocompletar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAutocompleteFieldRow(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const adicionarRegra = () => {
    if (!isExpanded) setIsExpanded(true);
    const novoId = regrasFiltro.length > 0 ? Math.max(...regrasFiltro.map(r => r.id)) + 1 : 1;
    setRegrasFiltro(prev => [
      ...prev,
      { id: novoId, type: 'custom', customField: 'DN', operator: 'contains', value: '' }
    ]);
  };

  const removerRegra = (id) => {
    setRegrasFiltro(prev => prev.filter(r => r.id !== id));
  };

  const atualizarRegra = (id, campo, valor) => {
    setRegrasFiltro(prev => prev.map(r => r.id === id ? { ...r, [campo]: valor } : r));
  };

  const totalFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (categoriaFiltro) count++;
    if (apenasNaoMapeados) count++;
    regrasFiltro.forEach(r => {
      if (r.value && r.value.trim()) count++;
    });
    return count;
  }, [categoriaFiltro, apenasNaoMapeados, regrasFiltro]);

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm transition-all duration-300 flex-shrink-0" ref={dropdownRef}>
      {/* ─── BARRA DE CABEÇALHO / GAVETA (Estilo FiltroFinanceiro.js) ─── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50/80 border-b border-gray-200">
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            totalFiltrosAtivos > 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700'
          }`}>
            <FontAwesomeIcon icon={faFilter} className="text-xs" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800 tracking-wide">Filtros Avançados do Modelo</span>
              {totalFiltrosAtivos > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-200">
                  {totalFiltrosAtivos} ativo{totalFiltrosAtivos > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Filtrar por Categoria, Nível, Parâmetros Customizados (DN, Seção, etc.)</p>
          </div>
          <FontAwesomeIcon 
            icon={isExpanded ? faChevronUp : faChevronDown} 
            className="text-gray-400 text-xs ml-2 group-hover:text-gray-600 transition-transform duration-200" 
          />
        </div>

        {/* Ações Rápidas do Cabeçalho */}
        <div className="flex items-center gap-2">
          {totalFiltrosAtivos > 0 && (
            <button
              onClick={onLimparTudo}
              className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:text-red-600 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              title="Resetar todos os filtros"
            >
              <FontAwesomeIcon icon={faUndo} className="text-[10px]" />
              <span>Limpar Filtros</span>
            </button>
          )}

          <button
            onClick={adicionarRegra}
            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Adicionar nova regra de filtro por parâmetro ou família"
          >
            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
            <span>Adicionar Regra</span>
          </button>
        </div>
      </div>

      {/* ─── PAINEL EXPANDIDO DE REGRAS ─── */}
      {isExpanded && (
        <div className="p-4 bg-white border-b border-gray-200 space-y-3">
          {/* Linha 1: Filtro Rápido de Categoria & Status de Orçamento */}
          <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100">
            {/* Categoria Revit */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <FontAwesomeIcon icon={faLayerGroup} className="text-blue-500 text-xs" />
                Categoria Revit:
              </label>
              <select
                value={categoriaFiltro}
                onChange={e => setCategoriaFiltro(e.target.value)}
                className="py-1 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-semibold text-gray-700 min-w-[200px]"
              >
                <option value="">Todas as Categorias ({listaCategoriasUnicas.length})</option>
                {listaCategoriasUnicas.map(catName => (
                  <option key={catName} value={catName}>
                    {catName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status de Orçamento */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs font-bold text-gray-500 mr-1">Status no Orçamento:</span>
              <button
                onClick={() => setApenasNaoMapeados(false)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  !apenasNaoMapeados ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setApenasNaoMapeados(true)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  apenasNaoMapeados ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Apenas Não Mapeados ⚠️
              </button>
            </div>
          </div>

          {/* Lista Dinâmica de Regras Adicionadas */}
          {regrasFiltro.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Nenhuma regra por parâmetro adicionada ainda. Clique em <strong className="text-blue-600">+ Adicionar Regra</strong> para filtrar por diâmetros (DN), famílias ou níveis!
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Regras Dinâmicas de Filtragem:</span>
              {regrasFiltro.map((regra, idx) => (
                <div key={regra.id} className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 relative group">
                  <span className="text-[10px] font-bold text-gray-400 w-6 text-center">#{idx + 1}</span>

                  {/* Tipo da Regra */}
                  <select
                    value={regra.type}
                    onChange={e => atualizarRegra(regra.id, 'type', e.target.value)}
                    className="py-1 px-2 text-xs border border-gray-200 rounded-md bg-white font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {FILTER_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>

                  {/* Se for propriedade customizada, exibe input/dropdown do parâmetro */}
                  {regra.type === 'custom' && (
                    <div className="relative">
                      <input
                        type="text"
                        value={regra.customField}
                        onChange={e => atualizarRegra(regra.id, 'customField', e.target.value)}
                        onFocus={() => setAutocompleteFieldRow(regra.id)}
                        placeholder="Nome do Parâmetro (ex: DN, Seção_b)"
                        className="py-1 px-2 text-xs border border-gray-200 rounded-md bg-white font-semibold text-blue-800 w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      {/* Autocomplete de propriedades do projeto */}
                      {autocompleteFieldRow === regra.id && todasPropriedades.length > 0 && (
                        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                          {todasPropriedades
                            .filter(p => p.toLowerCase().includes((regra.customField || '').toLowerCase()))
                            .slice(0, 25)
                            .map(propName => (
                              <div
                                key={propName}
                                onClick={() => {
                                  atualizarRegra(regra.id, 'customField', propName);
                                  setAutocompleteFieldRow(null);
                                  buscarValoresPropriedade(regra.id, propName, '');
                                }}
                                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer font-medium border-b border-gray-50 flex items-center justify-between"
                              >
                                <span>{propName}</span>
                                <span className="text-[9px] text-gray-400 font-normal">RPC</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operador */}
                  <select
                    value={regra.operator}
                    onChange={e => atualizarRegra(regra.id, 'operator', e.target.value)}
                    className="py-1 px-2 text-xs border border-gray-200 rounded-md bg-white font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {/* Valor do Filtro */}
                  <div className="relative flex-1 min-w-[160px]">
                    <input
                      type="text"
                      value={regra.value}
                      onChange={e => {
                        atualizarRegra(regra.id, 'value', e.target.value);
                        const campo = regra.type === 'custom' ? regra.customField : regra.type;
                        if (campo) buscarValoresPropriedade(regra.id, campo, e.target.value);
                      }}
                      onFocus={() => {
                        const campo = regra.type === 'custom' ? regra.customField : regra.type;
                        if (campo) buscarValoresPropriedade(regra.id, campo, regra.value);
                      }}
                      placeholder="Valor desejado (ex: 75, reboco, C-40)"
                      className="w-full py-1 pl-2 pr-7 text-xs border border-gray-200 rounded-md bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium"
                    />
                    {regra.value && (
                      <button
                        onClick={() => atualizarRegra(regra.id, 'value', '')}
                        className="absolute right-2 top-1.5 text-gray-300 hover:text-gray-500 text-xs"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    )}

                    {/* Autocomplete de Valores da RPC get_bim_field_values_v2 */}
                    {autocompleteValueRow === regra.id && valorSugestoes.length > 0 && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                        {valorSugestoes.map((sug, i) => (
                          <div
                            key={`${sug}-${i}`}
                            onClick={() => {
                              atualizarRegra(regra.id, 'value', String(sug));
                              setAutocompleteValueRow(null);
                            }}
                            className="px-3 py-1.5 text-xs text-gray-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer font-medium border-b border-gray-50 truncate"
                          >
                            {String(sug)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Excluir Regra */}
                  <button
                    onClick={() => removerRegra(regra.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remover esta regra"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chips / Pills de Regras Ativas */}
          {totalFiltrosAtivos > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filtros Aplicados:</span>
              {categoriaFiltro && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Cat: {categoriaFiltro}
                  <button onClick={() => setCategoriaFiltro('')} className="hover:text-blue-900 ml-0.5"><FontAwesomeIcon icon={faTimes} /></button>
                </span>
              )}
              {apenasNaoMapeados && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Apenas Não Mapeados
                  <button onClick={() => setApenasNaoMapeados(false)} className="hover:text-amber-900 ml-0.5"><FontAwesomeIcon icon={faTimes} /></button>
                </span>
              )}
              {regrasFiltro.filter(r => r.value && r.value.trim()).map(r => (
                <span key={`chip-${r.id}`} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {r.type === 'custom' ? r.customField : r.type} {r.operator === 'contains' ? 'contém' : r.operator === 'equals' ? '=' : r.operator} &quot;{r.value}&quot;
                  <button onClick={() => removerRegra(r.id)} className="hover:text-emerald-950 ml-0.5"><FontAwesomeIcon icon={faTimes} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

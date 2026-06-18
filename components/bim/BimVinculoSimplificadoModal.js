'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes, faSearch, faCheck, faTriangleExclamation, faSpinner,
  faPlus, faChevronRight, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

const fmt2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

export default function BimVinculoSimplificadoModal({
  isOpen,
  onClose,
  elemento, // { categoria, familia, ... }
  todosElementos = [],
  onSalvar,
  onExcluir,
  mapeamentoExistente,
  organizacaoId,
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState('categoria');
  const [materialSel, setMaterialSel] = useState(null); // { id, nome, unidade_medida, origem: 'proprio'|'sinapi' }
  const [fatorConversao, setFatorConversao] = useState('');
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('un');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState(null);

  // Inicialização e Reset de estados
  useEffect(() => {
    if (isOpen) {
      let escopoPadrao = 'categoria';
      if (elemento?.tipo) {
        escopoPadrao = 'tipo';
      } else if (elemento?.familia) {
        escopoPadrao = 'familia';
      }
      setEscopo(escopoPadrao);
      setFatorConversao('');
      setBusca('');
      setCriandoNovo(false);
      setNovoNome('');
      setSalvando(false);
      setErro(null);

      if (mapeamentoExistente) {
        setEscopo(mapeamentoExistente.escopo || escopoPadrao);
        setFatorConversao(mapeamentoExistente.fator_conversao || '');
        if (mapeamentoExistente.material_id || mapeamentoExistente.sinapi_id) {
          setMaterialSel({
            id: mapeamentoExistente.material_id || mapeamentoExistente.sinapi_id,
            nome: 'Carregando...',
            origem: mapeamentoExistente.material_id ? 'proprio' : 'sinapi',
            unidade_medida: mapeamentoExistente.unidade_override || 'un',
          });
        } else {
          setMaterialSel(null);
        }
      } else {
        setMaterialSel(null);
      }
    }
  }, [isOpen, mapeamentoExistente, elemento]);

  // Carrega nome de material mapeado em background
  const { data: materialNomeCarregado } = useQuery({
    queryKey: ['material_nome_simplificado_map', materialSel?.id, materialSel?.origem],
    queryFn: async () => {
      if (!materialSel?.id || materialSel.nome !== 'Carregando...') return null;
      if (materialSel.origem === 'sinapi') {
        const { data } = await supabase.from('sinapi').select('descricao, unidade_medida').eq('id', materialSel.id).single();
        return { nome: data?.descricao || 'Material Indisponível', unidade: data?.unidade_medida || 'un' };
      } else {
        const { data } = await supabase.from('materiais').select('nome, unidade_medida').eq('id', materialSel.id).single();
        return { nome: data?.nome || 'Material Indisponível', unidade: data?.unidade_medida || 'un' };
      }
    },
    enabled: !!materialSel && materialSel.nome === 'Carregando...',
  });

  useEffect(() => {
    if (materialNomeCarregado) {
      setMaterialSel(prev => prev ? {
        ...prev,
        nome: materialNomeCarregado.nome,
        unidade_medida: materialNomeCarregado.unidade
      } : null);
    }
  }, [materialNomeCarregado]);

  // Filtrar elementos do escopo atual para contar quantidade
  const elementosNoEscopo = useMemo(() => {
    // Se temos a contagem direta no elemento, podemos retornar um array fictício desse tamanho
    if (elemento?.total_elementos !== undefined && elemento.total_elementos !== null) {
      return Array(elemento.total_elementos).fill({});
    }
    if (!todosElementos || todosElementos.length === 0 || !elemento) return [];
    const cat = elemento.categoria || '';
    const fam = elemento.familia || '';
    const tip = elemento.tipo || '';

    return todosElementos.filter(el => {
      if (escopo === 'tipo') return el.categoria === cat && el.familia === fam && el.tipo === tip;
      if (escopo === 'familia') return el.categoria === cat && el.familia === fam;
      return el.categoria === cat; // Categoria
    });
  }, [todosElementos, elemento, escopo]);

  // Busca de materiais próprios + SINAPI
  const { data: resultadosBusca = [], isFetching: buscando } = useQuery({
    queryKey: ['bim_busca_material_simplificado', busca, organizacaoId],
    queryFn: async () => {
      if (busca.trim().length < 2) return [];
      const termo = `%${busca}%`;

      const [{ data: props }, { data: sinapi }] = await Promise.all([
        supabase
          .from('materiais')
          .select('id, nome, unidade_medida, preco_unitario, classificacao')
          .eq('organizacao_id', organizacaoId)
          .ilike('nome', termo)
          .limit(10),
        supabase
          .from('sinapi')
          .select('id, nome, descricao, unidade_medida, "Código da Composição"')
          .ilike('nome', termo)
          .limit(10),
      ]);

      return [
        ...(props || []).map(m => ({ ...m, origem: 'proprio' })),
        ...(sinapi || []).map(s => ({ ...s, nome: s.descricao || s.nome, origem: 'sinapi' })),
      ];
    },
    enabled: isOpen && busca.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  // Preview de impacto
  const impacto = useMemo(() => {
    const totalItens = elementosNoEscopo.length;
    let somaFinal = totalItens;

    if (fatorConversao.trim()) {
      try {
        const expressao = fatorConversao
          .replace(/,/g, '.')
          .replace(/\[quantidade\]|\[q\]/gi, totalItens.toString());
        const fn = new Function('return ' + expressao);
        const resultado = fn();
        if (typeof resultado === 'number' && !isNaN(resultado)) {
          somaFinal = resultado;
        }
      } catch (e) {}
    }

    return { qtd: totalItens, soma: somaFinal };
  }, [elementosNoEscopo, fatorConversao]);

  // Criar novo material inline
  const criarNovoMaterial = async () => {
    if (!novoNome.trim()) return;

    const { data, error } = await supabase
      .from('materiais')
      .insert({
        nome: novoNome,
        unidade_medida: novaUnidade,
        organizacao_id: organizacaoId,
        classificacao: 'Insumo'
      })
      .select()
      .single();
    if (error) { alert('Erro ao criar material: ' + error.message); return; }
    setMaterialSel({ ...data, origem: 'proprio' });
    setCriandoNovo(false);
    queryClient.invalidateQueries({ queryKey: ['materiais'] });
  };

  // Salvar mapeamento
  const handleSalvar = async () => {
    if (!materialSel) return;
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        propriedade_nome: `[ELEMENTO] ${elemento?.tipo || elemento?.familia || elemento?.categoria || 'Desconhecido'}`,
        propriedade_quantidade: null,
        categoria_bim: elemento?.categoria || null,
        familia_bim: (escopo === 'familia' || escopo === 'tipo') ? (elemento?.familia || null) : null,
        tipo_bim: escopo === 'tipo' ? (elemento?.tipo || null) : null,
        elemento_id: null,
        tipo_vinculo: 'elemento', // Contagem por unidades mapeia como tipo_vinculo 'elemento'
        escopo,
        fator_conversao: fatorConversao.trim() || null,
        material_id: materialSel.origem === 'proprio' ? materialSel.id : null,
        sinapi_id: materialSel.origem === 'sinapi' ? materialSel.id : null,
      };

      console.log('[SimplificadoModal] Salvando payload:', payload);
      await onSalvar(payload);
      onClose();
    } catch (e) {
      console.error('[SimplificadoModal] Erro ao salvar:', e);
      setErro(e?.message || 'Erro desconhecido ao salvar o vínculo.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!mapeamentoExistente) return;
    if (!window.confirm('Tem certeza que deseja remover este vínculo?')) return;
    setExcluindo(true);
    setErro(null);
    try {
      await onExcluir(mapeamentoExistente.id);
      onClose();
    } catch (e) {
      console.error('[SimplificadoModal] Erro ao excluir:', e);
      setErro(e?.message || 'Erro desconhecido ao excluir o vínculo.');
    } finally {
      setExcluindo(false);
    }
  };

  if (!isOpen) return null;

  const unidadeEstimada = materialSel?.unidade_medida || '';
  const podeConfirmar = !!materialSel && !salvando && !excluindo;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-5 flex-shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-all">
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75 mb-0.5">Vincular Grupo ao Orçamento</p>
          <h2 className="text-lg font-bold">Vincular por Unidades (Contagem)</h2>
          <p className="text-xs opacity-80 mt-0.5">
            {elemento?.categoria} {elemento?.familia ? `› ${elemento.familia}` : ''} {elemento?.tipo ? `› ${elemento.tipo}` : ''}
          </p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-6 space-y-5">
          
          {/* Banner Didático */}
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-850 rounded-xl p-4 text-xs leading-5">
            <strong>Vínculo por Quantidade de Peças:</strong><br/>
            O sistema contará cada elemento do(a) {escopo === 'tipo' ? 'tipo' : escopo === 'familia' ? 'família' : 'categoria'} como <u>1 unidade</u> do material selecionado abaixo. Não é necessário escolher propriedades do Revit neste nível.
          </div>

          {/* Busca de material */}
          <div className="pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">
              {materialSel ? 'Material selecionado' : 'Buscar material'}
            </p>

            {materialSel ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <FontAwesomeIcon icon={faCheck} className="text-green-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{materialSel.nome}</p>
                  <p className="text-[10px] text-gray-400">
                    {materialSel.origem === 'sinapi' ? 'SINAPI' : 'Material próprio'} · {materialSel.unidade_medida}
                  </p>
                </div>
                <button
                  onClick={() => setMaterialSel(null)}
                  className="text-xs text-red-400 hover:text-red-650 transition-colors font-semibold"
                >
                  trocar
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 text-gray-300 text-xs" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Nome do material ou composição SINAPI..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  {buscando && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-2.5 text-gray-400 text-xs" />}
                </div>

                {resultadosBusca.length > 0 && (
                  <div className="border border-gray-150 rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-white shadow-sm">
                    {resultadosBusca.map(m => (
                      <button
                        key={`${m.origem}_${m.id}`}
                        onClick={() => setMaterialSel(m)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${m.origem === 'sinapi' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {m.origem === 'sinapi' ? 'SINAPI' : 'PRÓPRIO'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{m.nome}</p>
                          <p className="text-[10px] text-gray-400">{m.unidade_medida}</p>
                        </div>
                        <FontAwesomeIcon icon={faChevronRight} className="text-gray-300 text-xs shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {busca.length >= 2 && !buscando && resultadosBusca.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhum resultado. Crie um novo material abaixo.</p>
                )}

                {!criandoNovo ? (
                  <button
                    onClick={() => { setCriandoNovo(true); setNovoNome(busca); }}
                    className="mt-2 w-full flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 py-1.5 justify-center hover:bg-blue-50 rounded-lg transition-colors font-semibold"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                    Criar novo material
                  </button>
                ) : (
                  <div className="mt-3 bg-blue-50 rounded-xl p-3 space-y-2 border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Novo Material</p>
                    <input
                      type="text"
                      value={novoNome}
                      onChange={e => setNovoNome(e.target.value)}
                      placeholder="Nome do material"
                      className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none bg-white focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex gap-2">
                      <select
                        value={novaUnidade}
                        onChange={e => setNovaUnidade(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none bg-white focus:ring-2 focus:ring-blue-400"
                      >
                        {['m³', 'm²', 'm', 'mm', 'kg', 'ton', 'un', 'l', 'verba'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <button onClick={criarNovoMaterial} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">
                        Criar
                      </button>
                      <button onClick={() => setCriandoNovo(false)} className="px-3 py-1.5 text-gray-400 text-xs hover:text-red-500 transition-colors">
                        cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fator de conversão */}
          <div className="pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Fator de Conversão Matemático</p>
            <p className="text-[11px] text-gray-550 mb-3 leading-relaxed">
              Exemplo: Para adicionar uma margem de quebra de 5% sobre a contagem de peças, digite <code className="bg-gray-150 text-pink-650 px-1 py-0.5 rounded font-bold font-mono">[q] * 1.05</code>
            </p>
            <input
              type="text"
              value={fatorConversao}
              onChange={e => setFatorConversao(e.target.value)}
              placeholder="Ex: [quantidade] * 1.05"
              className="w-full px-4 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white focus:bg-blue-50/10 transition-all font-bold text-gray-700"
            />
          </div>

          {/* Preview de impacto */}
          <div className="pt-4 bg-gray-50/75 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Impacto do Mapeamento</p>
            <div className="flex gap-4">
              <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
                <p className="text-xl font-black text-blue-700">{impacto.qtd}</p>
                <p className="text-[10px] text-gray-400 font-semibold">elementos no(a) {escopo === 'tipo' ? 'tipo' : escopo === 'familia' ? 'família' : 'categoria'}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
                <p className="text-xl font-black text-gray-800">
                  {fmt2(impacto.soma)}
                </p>
                <p className="text-[10px] text-gray-400 font-semibold">
                  {unidadeEstimada || 'unidades'} estimadas
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 flex-shrink-0">
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              <span><strong>Erro ao salvar:</strong> {erro}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div>
              {mapeamentoExistente && (
                <button
                  onClick={handleExcluir}
                  disabled={excluindo || salvando}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  {excluindo && <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />}
                  Remover Vínculo
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2 text-sm text-gray-655 hover:text-gray-850 transition-colors font-medium">
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!podeConfirmar || salvando || excluindo}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {salvando && <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />}
                Salvar Vínculo
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

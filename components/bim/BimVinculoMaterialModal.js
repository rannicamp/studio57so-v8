'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes, faSearch, faBoxOpen, faLayerGroup,
  faBarcode, faCheck, faTriangleExclamation, faSpinner,
  faPlus, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';

const ESCOPOS = [
  { valor: 'familia',   label: 'Apenas esta Família',  desc: 'Só elementos desta família específica',        cor: 'text-red-600'    },
  { valor: 'categoria', label: 'Toda a Categoria',      desc: 'Todos os elementos desta categoria BIM',       cor: 'text-amber-600'  },
  { valor: 'projeto',   label: 'Todo o Projeto',        desc: 'Qualquer elemento com esta propriedade',       cor: 'text-green-700'  },
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function BimVinculoMaterialModal({
  isOpen,
  onClose,
  // Contexto do elemento onde o usuário clicou
  propriedade,        // { nome: "Volume", valor: 2.75 }
  elemento,           // { categoria, familia, tipo, ... }
  // Elementos do modelo (para preview de impacto)
  todosElementos = [],
  // Callback ao salvar
  onSalvar,
  // Dados da organização
  organizacaoId,
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState('categoria');
  const [tipoVinculo, setTipoVinculo] = useState('material');
  const [materialSel, setMaterialSel] = useState(null); // { id, nome, unidade_medida, origem: 'proprio'|'sinapi' }
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('un');
  const [salvando, setSalvando] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setBusca('');
      setEscopo('categoria');
      setTipoVinculo('material');
      setMaterialSel(null);
      setCriandoNovo(false);
      setNovoNome('');
      setSalvando(false);
    }
  }, [isOpen]);

  // ─── Busca materiais próprios + SINAPI ────────────────────────────────────
  const { data: resultadosBusca = [], isFetching: buscando } = useQuery({
    queryKey: ['bim_busca_material', busca, organizacaoId],
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
        ...(sinapi || []).map(s => ({ ...s, origem: 'sinapi' })),
      ];
    },
    enabled: isOpen && busca.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  // ─── Preview de impacto ───────────────────────────────────────────────────
  const impacto = (() => {
    if (!propriedade || !todosElementos.length) return { qtd: 0, soma: 0 };
    const cat = elemento?.categoria || '';
    const fam = elemento?.familia   || '';

    const filtrados = todosElementos.filter(el => {
      if (escopo === 'familia')   return el.categoria === cat && el.familia === fam;
      if (escopo === 'categoria') return el.categoria === cat;
      return true; // projeto
    });

    let soma = 0, qtd = 0;
    filtrados.forEach(el => {
      const val = parseFloat((el.propriedades || {})[propriedade.nome]);
      if (!isNaN(val) && val > 0) { soma += val; qtd++; }
    });
    return { qtd, soma };
  })();

  // ─── Criar novo material inline ───────────────────────────────────────────
  const criarNovoMaterial = async () => {
    if (!novoNome.trim()) return;
    const { data, error } = await supabase
      .from('materiais')
      .insert({
        nome: novoNome,
        unidade_medida: novaUnidade,
        organizacao_id: organizacaoId,
        classificacao: 'material',
      })
      .select()
      .single();
    if (error) { alert('Erro ao criar material: ' + error.message); return; }
    setMaterialSel({ ...data, origem: 'proprio' });
    setCriandoNovo(false);
    queryClient.invalidateQueries({ queryKey: ['materiais'] });
  };

  const [erro, setErro] = useState(null);

  // ─── Salvar mapeamento ────────────────────────────────────────────────────
  const handleSalvar = async () => {
    if (tipoVinculo === 'material' && !materialSel) return;
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        propriedade_nome: tipoVinculo === 'elemento' ? `[ELEMENTO] ${elemento?.familia || elemento?.categoria || 'Desconhecido'}` : propriedade.nome,
        propriedade_quantidade: tipoVinculo === 'elemento' ? propriedade.nome : null,
        categoria_bim:    escopo !== 'projeto' ? (elemento?.categoria || null) : null,
        familia_bim:      escopo === 'familia' ? (elemento?.familia   || null) : null,
        tipo_vinculo:     tipoVinculo,
        escopo,
        material_id:      (tipoVinculo === 'material' || tipoVinculo === 'elemento') && materialSel?.origem === 'proprio' ? materialSel.id : null,
        sinapi_id:        (tipoVinculo === 'material' || tipoVinculo === 'elemento') && materialSel?.origem === 'sinapi'  ? materialSel.id : null,
      };
      console.log('[Modal] Salvando payload:', payload);
      await onSalvar(payload);
      onClose();
    } catch (e) {
      console.error('[Modal] Erro ao salvar:', e);
      setErro(e?.message || 'Erro desconhecido ao salvar o vínculo.');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !propriedade) return null;

  const unidadeEstimada = materialSel?.unidade_medida || '';
  const podeConfirmar   = (tipoVinculo !== 'material' && tipoVinculo !== 'elemento') || materialSel;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-5">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-all">
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75 mb-0.5">Vincular Propriedade BIM</p>
          <h2 className="text-lg font-bold">{propriedade.nome}</h2>
          <p className="text-xs opacity-80 mt-0.5">
            {elemento?.categoria} › {elemento?.familia} › {elemento?.tipo}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">

          {/* Tipo de vínculo */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Este campo representa:</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'material',     icon: '📦', label: 'Material' },
                { v: 'elemento',     icon: '🧱', label: 'Elem. Inteiro' },
                { v: 'ignorar',      icon: '❌', label: 'Ignorar' },
              ].map(op => (
                <button
                  key={op.v}
                  onClick={() => setTipoVinculo(op.v)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all
                    ${tipoVinculo === op.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                >
                  <span className="text-xl">{op.icon}</span>
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {(tipoVinculo === 'material' || tipoVinculo === 'elemento') && (
            <>
              {tipoVinculo === 'elemento' && (
                <div className="px-6 pt-4 pb-1">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs leading-5">
                    <strong>Atenção:</strong> Você está mapeando o elemento inteiro ({elemento?.familia || elemento?.categoria}).<br/>
                    A propriedade <span className="font-bold">"{propriedade.nome}"</span> será usada apenas para extrair a <u>quantidade/medida</u> deste material.
                  </div>
                </div>
              )}
              {/* Busca de material */}
              <div className="px-6 py-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">
                  {materialSel ? 'Material selecionado' : 'Buscar material'}
                </p>

                {materialSel ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <FontAwesomeIcon icon={faCheck} className="text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{materialSel.nome}</p>
                      <p className="text-[10px] text-gray-400">
                        {materialSel.origem === 'sinapi' ? 'SINAPI' : 'Material próprio'} · {materialSel.unidade_medida}
                      </p>
                    </div>
                    <button
                      onClick={() => setMaterialSel(null)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2.5 text-gray-300 text-xs" />
                      <input
                        autoFocus
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Nome do material ou composição SINAPI..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      {buscando && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-2.5 text-gray-400 text-xs" />}
                    </div>

                    {/* Resultados */}
                    {resultadosBusca.length > 0 && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
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

                    {/* Criar novo material */}
                    {!criandoNovo ? (
                      <button
                        onClick={() => { setCriandoNovo(true); setNovoNome(busca); }}
                        className="mt-2 w-full flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 py-1.5 justify-center hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                        Criar novo material
                      </button>
                    ) : (
                      <div className="mt-3 bg-blue-50 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Novo Material</p>
                        <input
                          type="text"
                          value={novoNome}
                          onChange={e => setNovoNome(e.target.value)}
                          placeholder="Nome do material"
                          className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <div className="flex gap-2">
                          <select
                            value={novaUnidade}
                            onChange={e => setNovaUnidade(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
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

              {/* Escopo */}
              <div className="px-6 py-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Aplicar esta regra em:</p>
                <div className="space-y-1.5">
                  {ESCOPOS.map(op => (
                    <button
                      key={op.valor}
                      onClick={() => setEscopo(op.valor)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all
                        ${escopo === op.valor ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0
                        ${escopo === op.valor ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {escopo === op.valor && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${escopo === op.valor ? 'text-blue-700' : 'text-gray-700'}`}>{op.label}</p>
                        <p className="text-[10px] text-gray-400">{op.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Preview de impacto */}
          <div className="px-6 py-4 bg-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Impacto desta regra</p>
            <div className="flex gap-4">
              <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                <p className="text-2xl font-black text-blue-700">{impacto.qtd}</p>
                <p className="text-[10px] text-gray-400 font-semibold">elementos afetados</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                <p className="text-2xl font-black text-gray-800">
                  {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(impacto.soma)}
                </p>
                <p className="text-[10px] text-gray-400 font-semibold">{unidadeEstimada || 'total'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 space-y-3">
          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              <span><strong>Erro ao salvar:</strong> {erro}</span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={!podeConfirmar || salvando}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando && <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />}
              {tipoVinculo === 'ignorar' ? 'Marcar como Ignorar' : 'Salvar Vínculo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

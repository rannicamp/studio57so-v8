'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes, faSearch, faBoxOpen, faLayerGroup,
  faBarcode, faCheck, faTriangleExclamation, faSpinner,
  faPlus, faChevronRight, faLink, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

// ─── Prioridade de escopos
const ESCOPOS = [
  { valor: 'tipo', label: 'Apenas este Tipo', desc: 'Só elementos com este EXATO tipo', cor: 'text-blue-600' },
  { valor: 'familia', label: 'Toda a Família', desc: 'Todos os tipos desta família e categoria', cor: 'text-red-600' },
  { valor: 'categoria', label: 'Toda a Categoria', desc: 'Todos os elementos desta categoria BIM', cor: 'text-amber-600' },
  { valor: 'projeto', label: 'Todo o Projeto', desc: 'Qualquer elemento do modelo com esta prop. (Cuidado!)', cor: 'text-green-700' },
];

const fmt2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// Detecta a unidade de uma medida a partir do label
function detectarUnidade(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('volume'))      return 'm³';
  if (l.includes('área') || l.includes('area')) return 'm²';
  if (l.includes('comprimento') || l.includes('length')) return 'm';
  if (l.includes('diâmetro') || l.includes('diametro')) return 'mm';
  return 'un';
}

// Badge de Unidade
const BadgeUnidade = ({ unidade }) => (
  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono bg-gray-150 text-gray-500 border border-gray-200 select-none">
    {unidade}
  </span>
);

export default function BimVinculoMaterialModal({
  isOpen,
  onClose,
  elemento, // { categoria, familia, tipo, ... }
  todosElementos = [],
  onSalvar,
  onExcluir,
  mapeamentoExistente,
  organizacaoId,
  mapeamentos = [], // Nova prop
  propriedadeInicialNome = '', // Propriedade vinda do clique no inspector
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const escoposDisponiveis = useMemo(() => {
    if (elemento?.external_id) {
      return [
        { valor: 'elemento', label: 'Apenas esta Instância', desc: 'Só este elemento físico no modelo 3D', cor: 'text-purple-650 font-bold' },
        { valor: 'tipo', label: 'Apenas este Tipo', desc: 'Só elementos com este EXATO tipo', cor: 'text-blue-600' },
        { valor: 'familia', label: 'Toda a Família', desc: 'Todos os tipos desta família e categoria', cor: 'text-red-600' },
        { valor: 'categoria', label: 'Toda a Categoria', desc: 'Todos os elementos desta categoria BIM', cor: 'text-amber-600' },
        { valor: 'projeto', label: 'Todo o Projeto', desc: 'Qualquer elemento do modelo com esta prop. (Cuidado!)', cor: 'text-green-700' },
      ];
    }
    return [
      { valor: 'tipo', label: 'Apenas este Tipo', desc: 'Só elementos com este EXATO tipo', cor: 'text-blue-600' },
      { valor: 'familia', label: 'Toda a Família', desc: 'Todos os tipos desta família e categoria', cor: 'text-red-600' },
      { valor: 'categoria', label: 'Toda a Categoria', desc: 'Todos os elementos desta categoria BIM', cor: 'text-amber-600' },
      { valor: 'projeto', label: 'Todo o Projeto', desc: 'Qualquer elemento do modelo com esta prop. (Cuidado!)', cor: 'text-green-700' },
    ];
  }, [elemento]);

  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState('categoria');
  const [tipoVinculo, setTipoVinculo] = useState('material');
  const [fatorConversao, setFatorConversao] = useState('');
  const [materialSel, setMaterialSel] = useState(null); // { id, nome, unidade_medida, origem: 'proprio'|'sinapi' }
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('un');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState(null);

  // Estados locais para controle de propriedades dinâmicas
  const [propriedadeSelecionadaNome, setPropriedadeSelecionadaNome] = useState('');
  const [buscaPropriedade, setBuscaPropriedade] = useState('');

  // 1. Filtrar elementos do escopo atual
  const elementosNoEscopo = useMemo(() => {
    if (!elemento) return [];
    if (escopo === 'elemento') return [elemento];
    if (!todosElementos || todosElementos.length === 0) return [];
    
    const cat = elemento.categoria || '';
    const fam = elemento.familia || '';
    const tip = elemento.tipo || '';

    return todosElementos.filter(el => {
      if (escopo === 'tipo') return el.categoria === cat && el.familia === fam && el.tipo === tip;
      if (escopo === 'familia') return el.categoria === cat && el.familia === fam;
      if (escopo === 'categoria') return el.categoria === cat;
      return true; // projeto
    });
  }, [todosElementos, elemento, escopo]);

  // 2. Scanner dinâmico de todas as propriedades das instâncias
  const propriedadesDisponiveis = useMemo(() => {
    if (elementosNoEscopo.length === 0) return [];

    const mapaProp = {};
    elementosNoEscopo.forEach(el => {
      const props = el.propriedades || {};
      Object.entries(props).forEach(([chave, valor]) => {
        if (!chave || chave.startsWith('<') || chave.includes('id') || chave === 'projeto_bim_id') return;

        const valorNum = parseFloat(valor);
        const ehNumerico = !isNaN(valorNum);

        if (!mapaProp[chave]) {
          mapaProp[chave] = {
            nome: chave,
            valorAmostra: valor,
            ehNumerico,
            soma: 0,
            unidade: ehNumerico ? detectarUnidade(chave) : 'txt'
          };
        }

        if (ehNumerico && valorNum > 0) {
          mapaProp[chave].soma += valorNum;
        }
      });
    });

    return Object.values(mapaProp).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [elementosNoEscopo]);

  // 3. Inicialização e Reset de estados
  useEffect(() => {
    if (isOpen) {
      setBuscaPropriedade('');
      if (mapeamentoExistente) {
        setEscopo(mapeamentoExistente.escopo || (elemento?.external_id ? 'elemento' : elemento?.tipo ? 'tipo' : elemento?.familia ? 'familia' : 'categoria'));
        setTipoVinculo(mapeamentoExistente.tipo_vinculo || 'material');
        setFatorConversao(mapeamentoExistente.fator_conversao || '');
        setBusca('');
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
        setPropriedadeSelecionadaNome(mapeamentoExistente.propriedade_nome || '');
      } else {
        setBusca('');
        
        // Tentar encontrar uma propriedade e material pré-selecionados herdados do Tipo, Família ou Categoria
        let propHerdada = '';
        let materialHerdado = null;
        let fatorHerdado = '';
        
        if (elemento) {
          const cat = elemento.categoria || '';
          const fam = elemento.familia || '';
          const tip = elemento.tipo || '';
          
          const mapHerdado = mapeamentos.find(m => 
            (m.escopo === 'tipo' && m.categoria_bim === cat && m.familia_bim === fam && m.tipo_bim === tip) ||
            (m.escopo === 'familia' && m.categoria_bim === cat && m.familia_bim === fam) ||
            (m.escopo === 'categoria' && m.categoria_bim === cat)
          );
          
          if (mapHerdado) {
            propHerdada = mapHerdado.propriedade_nome || '';
            fatorHerdado = mapHerdado.fator_conversao || '';
            if (mapHerdado.material_id || mapHerdado.sinapi_id) {
              materialHerdado = {
                id: mapHerdado.material_id || mapHerdado.sinapi_id,
                nome: 'Carregando...',
                origem: mapHerdado.material_id ? 'proprio' : 'sinapi',
                unidade_medida: mapHerdado.unidade_override || 'un',
              };
            }
          }
        }

        setEscopo(elemento?.external_id ? 'elemento' : elemento?.tipo ? 'tipo' : elemento?.familia ? 'familia' : 'categoria');
        setTipoVinculo(propHerdada && propHerdada.startsWith('[ELEMENTO]') ? 'elemento' : 'material');
        setFatorConversao(fatorHerdado);
        setMaterialSel(materialHerdado);
        setPropriedadeSelecionadaNome(propriedadeInicialNome || propHerdada);
      }
      setCriandoNovo(false);
      setNovoNome('');
      setSalvando(false);
      setErro(null);
    }
  }, [isOpen, mapeamentoExistente, elemento, propriedadeInicialNome]);

  // Auto-seleção inteligente de propriedade se vazia
  useEffect(() => {
    if (isOpen && propriedadesDisponiveis.length > 0 && !propriedadeSelecionadaNome) {
      const preferidas = ['Volume', 'Área', 'Area', 'Comprimento', 'Length'];
      const encontrada = propriedadesDisponiveis.find(p => preferidas.includes(p.nome) && p.ehNumerico);
      if (encontrada) {
        setPropriedadeSelecionadaNome(encontrada.nome);
      } else {
        const primeiraNum = propriedadesDisponiveis.find(p => p.ehNumerico);
        if (primeiraNum) {
          setPropriedadeSelecionadaNome(primeiraNum.nome);
        } else if (propriedadesDisponiveis[0]) {
          setPropriedadeSelecionadaNome(propriedadesDisponiveis[0].nome);
        }
      }
    }
  }, [isOpen, propriedadesDisponiveis, propriedadeSelecionadaNome]);

  // Carrega nome de material mapeado em background
  const { data: materialNomeCarregado } = useQuery({
    queryKey: ['material_nome_map', materialSel?.id, materialSel?.origem],
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

  // Resolvendo a propriedade ativa
  const propriedadeAtiva = useMemo(() => {
    if (!propriedadeSelecionadaNome) return { nome: 'Quantidade', valor: elementosNoEscopo.length, unidade: 'un' };

    const encontrada = propriedadesDisponiveis.find(p => p.nome === propriedadeSelecionadaNome);
    if (encontrada) {
      return {
        nome: encontrada.nome,
        valor: encontrada.ehNumerico ? encontrada.soma : 0,
        unidade: encontrada.unidade
      };
    }

    if (propriedadeSelecionadaNome === 'Quantidade' || propriedadeSelecionadaNome.startsWith('[ELEMENTO]')) {
      return {
        nome: 'Quantidade',
        valor: elementosNoEscopo.length,
        unidade: 'un'
      };
    }

    return { nome: propriedadeSelecionadaNome, valor: 0, unidade: 'un' };
  }, [propriedadeSelecionadaNome, propriedadesDisponiveis, elementosNoEscopo]);

  // Busca de materiais próprios + SINAPI
  const { data: resultadosBusca = [], isFetching: buscando } = useQuery({
    queryKey: ['bim_busca_material_modal', busca, organizacaoId],
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
    if (!elementosNoEscopo.length) return { qtd: 0, soma: 0 };

    let soma = 0, qtd = 0;
    elementosNoEscopo.forEach(el => {
      if (tipoVinculo === 'elemento_unidades') {
        soma += 1;
        qtd++;
      } else {
        const props = el.propriedades || {};
        const val = parseFloat(props[propriedadeAtiva.nome]);
        if (!isNaN(val) && val > 0) {
          soma += val;
          qtd++;
        }
      }
    });

    let somaFinal = soma;
    if (fatorConversao.trim()) {
      try {
        const expressao = fatorConversao
          .replace(/,/g, '.')
          .replace(/\[quantidade\]|\[q\]/gi, soma.toString());
        const fn = new Function('return ' + expressao);
        const resultado = fn();
        if (typeof resultado === 'number' && !isNaN(resultado)) {
          somaFinal = resultado;
        }
      } catch (e) {}
    }

    return { qtd, somaRaw: soma, soma: somaFinal };
  }, [elementosNoEscopo, tipoVinculo, propriedadeAtiva, fatorConversao]);

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
    if (tipoVinculo === 'material' && !materialSel) return;
    setSalvando(true);
    setErro(null);
    try {
      const isElemento = tipoVinculo === 'elemento' || tipoVinculo === 'elemento_unidades';
      const payload = {
        propriedade_nome: isElemento ? `[ELEMENTO] ${elemento?.tipo || elemento?.familia || elemento?.categoria || 'Desconhecido'}` : propriedadeAtiva.nome,
        propriedade_quantidade: tipoVinculo === 'elemento' ? propriedadeAtiva.nome : null,
        categoria_bim: escopo !== 'projeto' ? (elemento?.categoria || null) : null,
        familia_bim: (escopo === 'familia' || escopo === 'tipo' || escopo === 'elemento') ? (elemento?.familia || null) : null,
        tipo_bim: (escopo === 'tipo' || escopo === 'elemento') ? (elemento?.tipo || null) : null,
        elemento_id: (escopo === 'elemento') ? (elemento?.external_id || null) : null,
        tipo_vinculo: isElemento ? 'elemento' : tipoVinculo,
        escopo,
        fator_conversao: fatorConversao.trim() || null,
        material_id: (tipoVinculo === 'material' || isElemento) && materialSel?.origem === 'proprio' ? materialSel.id : null,
        sinapi_id: (tipoVinculo === 'material' || isElemento) && materialSel?.origem === 'sinapi' ? materialSel.id : null,
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

  const handleExcluir = async () => {
    if (!mapeamentoExistente) return;
    if (!window.confirm('Tem certeza que deseja remover este vínculo?')) return;
    setExcluindo(true);
    setErro(null);
    try {
      await onExcluir(mapeamentoExistente.id);
      onClose();
    } catch (e) {
      console.error('[Modal] Erro ao excluir:', e);
      setErro(e?.message || 'Erro desconhecido ao excluir o vínculo.');
    } finally {
      setExcluindo(false);
    }
  };

  const propriedadesFiltradas = useMemo(() => {
    if (!buscaPropriedade.trim()) return propriedadesDisponiveis;
    const t = buscaPropriedade.toLowerCase();
    return propriedadesDisponiveis.filter(p => p.nome.toLowerCase().includes(t));
  }, [propriedadesDisponiveis, buscaPropriedade]);

  if (!isOpen) return null;

  const unidadeEstimada = materialSel?.unidade_medida || '';
  const podeConfirmar = (tipoVinculo !== 'material' && tipoVinculo !== 'elemento' && tipoVinculo !== 'elemento_unidades') || materialSel;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300 ${propriedadeInicialNome ? 'max-w-xl' : 'max-w-4xl'}`}>
        
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-5 flex-shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-all">
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75 mb-0.5">
            {propriedadeInicialNome ? 'Mapear Parâmetro do Elemento' : 'Vincular Propriedade BIM'}
          </p>
          <h2 className="text-lg font-bold">
            {propriedadeInicialNome ? `Vincular Propriedade: ${propriedadeAtiva?.nome}` : (propriedadeAtiva?.nome || 'Contar por Unidades')}
          </h2>
          <p className="text-xs opacity-80 mt-0.5">
            {elemento?.categoria} {elemento?.familia ? `› ${elemento.familia}` : ''} {elemento?.tipo ? `› ${elemento.tipo}` : ''}
          </p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Coluna Esquerda: Formulário de Configuração */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
            
            {/* Seletor de Medida/Propriedade */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Propriedade de Medida:</p>
              {propriedadeInicialNome ? (
                <div className="bg-blue-50 border border-blue-150 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📐</span>
                    <div>
                      <p className="text-sm font-bold text-blue-900 leading-tight">{propriedadeAtiva.nome}</p>
                      <p className="text-[9px] text-blue-500 font-extrabold uppercase mt-0.5">Parâmetro Selecionado</p>
                    </div>
                  </div>
                  <BadgeUnidade unidade={propriedadeAtiva.unidade} />
                </div>
              ) : (
                <select
                  value={propriedadeSelecionadaNome}
                  onChange={e => setPropriedadeSelecionadaNome(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-gray-700 bg-white"
                >
                  <option value="Quantidade">🔢 Contar por Unidades (Peças)</option>
                  <optgroup label="Propriedades do Revit">
                    {propriedadesDisponiveis.map(p => (
                      <option key={p.nome} value={p.nome}>
                        {p.ehNumerico ? '📐' : '📝'} {p.nome} ({p.unidade})
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
            </div>

            {/* Tipo de vínculo */}
            {!propriedadeInicialNome && (
              <div className="px-6 py-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Este campo representa:</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'material', icon: '📦', label: 'Material' },
                    { v: 'elemento', icon: '🧱', label: 'Elem. (Medida)' },
                    { v: 'elemento_unidades', icon: '🔢', label: 'Elem. (Unidade)' },
                  ].map(op => (
                    <button
                      key={op.v}
                      onClick={() => setTipoVinculo(op.v)}
                      className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border-2 text-[10px] leading-tight font-semibold transition-all
                      ${tipoVinculo === op.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                    >
                      <span className="text-xl">{op.icon}</span>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(tipoVinculo === 'material' || tipoVinculo === 'elemento' || tipoVinculo === 'elemento_unidades') && (
              <>
                {tipoVinculo === 'elemento' && (
                  <div className="px-6 pt-4 pb-1">
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs leading-5">
                      <strong>Atenção:</strong> Você está mapeando o elemento inteiro.<br/>
                      A propriedade <span className="font-bold">&quot;{propriedadeAtiva.nome}&quot;</span> será usada apenas para extrair a <u>quantidade/medida</u> deste material.
                    </div>
                  </div>
                )}
                {tipoVinculo === 'elemento_unidades' && (
                  <div className="px-6 pt-4 pb-1">
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl p-3 text-xs leading-5">
                      <strong>Atenção:</strong> Você está mapeando por unidades.<br/>
                      O sistema irá contar cada peça encontrada no modelo como <u>1 unidade</u> deste material.
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{materialSel.nome}</p>
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
                          type="text"
                          value={busca}
                          onChange={e => setBusca(e.target.value)}
                          placeholder="Nome do material ou composição SINAPI..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {buscando && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-2.5 text-gray-400 text-xs" />}
                      </div>

                      {resultadosBusca.length > 0 && (
                        <div className="border border-gray-150 rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-white">
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
                          className="mt-2 w-full flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 py-1.5 justify-center hover:bg-blue-50 rounded-lg transition-colors"
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
              </>
            )}

            {/* Escopo */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Aplicar esta regra em:</p>
              <div className="space-y-1.5">
                {escoposDisponiveis.map(op => (
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
                      <p className={`text-xs font-bold ${escopo === op.valor ? 'text-blue-700' : 'text-gray-700'}`}>
                        {op.label}
                        {escopo === op.valor && op.valor === 'tipo' && elemento?.tipo && (
                          <span className="font-mono text-[9px] bg-blue-100 text-blue-800 ml-2 px-1 rounded border border-blue-200 truncate max-w-[120px] inline-block align-bottom">{elemento.tipo}</span>
                        )}
                        {escopo === op.valor && op.valor === 'elemento' && elemento?.external_id && (
                          <span className="font-mono text-[9px] bg-purple-100 text-purple-800 ml-2 px-1 rounded border border-purple-200 inline-block align-bottom">ID: {elemento.external_id}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">{op.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {escopo === 'projeto' && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 shrink-0 text-red-500 animate-pulse" />
                  <span>
                    <strong>Cuidado!</strong> O escopo &quot;Todo o Projeto&quot; irá aplicar esse material em todos os elementos do modelo BIM que tenham a propriedade selecionada. Use com atenção!
                  </span>
                </div>
              )}
            </div>

            {/* Fator de conversão */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Fator de Conversão Matemático</p>
              <p className="text-[11px] text-gray-550 mb-3 leading-relaxed">
                Se a unidade do material for diferente da unidade do modelo, você pode usar uma fórmula matemática. Exemplo: Para converter Metros em Barras de 12m, digite <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded font-bold font-mono">[q] / 12</code>
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
            <div className="px-6 py-4 bg-gray-50/75">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Impacto desta regra</p>
              <div className="flex gap-4">
                <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
                  <p className="text-xl font-black text-blue-700">{impacto.qtd}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">elementos afetados</p>
                </div>
                <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
                  <p className="text-xl font-black text-gray-800">
                    {tipoVinculo === 'elemento_unidades' ? impacto.soma.toLocaleString('pt-BR')
                    : fmt2(impacto.soma)}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {tipoVinculo === 'elemento_unidades' ? 'unidades' : (unidadeEstimada || 'total')}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Coluna Direita: Amostra Completa de Propriedades BIM (Substitui Sidebar) */}
          {!propriedadeInicialNome && (
            <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-150 p-6 overflow-hidden">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Inspecionar Propriedades BIM</p>
              <p className="text-[10px] text-gray-400 mb-3 leading-normal">Escolha abaixo as propriedades e valores extraídos diretamente das instâncias do modelo BIM.</p>
              
              <div className="relative mb-3 flex-shrink-0">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-2 text-gray-300 text-[10px]" />
                <input
                  type="text"
                  value={buscaPropriedade}
                  onChange={e => setBuscaPropriedade(e.target.value)}
                  placeholder="Filtrar propriedades..."
                  className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                <div className="divide-y divide-gray-100">
                  {propriedadesFiltradas.map(p => {
                    const selecionada = propriedadeSelecionadaNome === p.nome;
                    return (
                      <button
                        key={p.nome}
                        onClick={() => {
                          if (p.ehNumerico) {
                            setPropriedadeSelecionadaNome(p.nome);
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-xs transition-all
                          ${selecionada ? 'bg-blue-50/80 font-bold border-l-4 border-blue-500' : 'hover:bg-gray-50'}
                          ${!p.ehNumerico ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        title={!p.ehNumerico ? 'Propriedade de texto (não quantificável)' : 'Clique para selecionar'}
                        disabled={!p.ehNumerico}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className={`truncate ${selecionada ? 'text-blue-700 font-bold' : 'text-gray-700'}`}>
                            {p.ehNumerico ? '📐' : '📝'} {p.nome}
                          </span>
                          {p.ehNumerico && (
                            <span className="text-[9px] text-gray-400 font-mono mt-0.5">
                              Soma: {fmt2(p.soma)} {p.unidade}
                            </span>
                          )}
                        </div>
                        <span 
                          className="text-[9px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0 truncate max-w-[120px]" 
                          title={String(p.valorAmostra)}
                        >
                          {String(p.valorAmostra)}
                        </span>
                      </button>
                    );
                  })}
                  {propriedadesFiltradas.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-gray-400 font-semibold italic">
                      Nenhuma propriedade encontrada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
              <button onClick={onClose} className="px-5 py-2 text-sm text-gray-650 hover:text-gray-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!podeConfirmar || salvando || excluindo}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {salvando && <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />}
                {tipoVinculo === 'ignorar' ? 'Marcar como Ignorar' : 'Salvar Vínculo'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

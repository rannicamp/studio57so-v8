'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCubes, faChevronDown, faChevronRight, faSpinner, faHome,
  faBuilding, faCheck, faLayerGroup, faRuler, faRulerCombined,
  faFileExport, faArrowRight, faAngleDown, faAngleRight,
  faTriangleExclamation, faBoxOpen, faExpand, faCompress,
  faSearch, faBarcode, faLink, faBan, faRuler as faRulerIcon,
  faDollarSign, faExclamationTriangle, faChevronRight as faChevRight,
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useBimQuantitativos } from '@/hooks/bim/useBimQuantitativos';
import { useBimMapeamentos }    from '@/hooks/bim/useBimMapeamentos';
import BimImportModal           from '@/components/orcamento/BimImportModal';
import BimVinculoMaterialModal  from '@/components/bim/BimVinculoMaterialModal';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const BadgeStatus = ({ status }) => {
  const cfg = {
    processado: 'bg-green-50 text-green-700 border-green-200',
    ativo: 'bg-green-50 text-green-700 border-green-200',
    processando: 'bg-amber-50 text-amber-700 border-amber-200',
    pendente: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  const cls = cfg[status?.toLowerCase()] || cfg['pendente'];
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase border ${cls}`}>
      {status || 'Disponível'}
    </span>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function BimQuantitativosPage() {
  const supabase = createClient();
  const { organizacao_id, user } = useAuth();

  const [isDropdownEmpAberto, setIsDropdownEmpAberto] = useState(false);
  const [isBimModalAberto, setIsBimModalAberto] = useState(false);
  const [buscaElemento, setBuscaElemento] = useState('');
  const [medidasSelecionadas, setMedidasSelecionadas] = useState({});
  const [abaAtiva, setAbaAtiva] = useState('elementos'); // 'elementos' | 'por-material'
  const [vinculoModal, setVinculoModal] = useState(null); // { propriedade, elemento }
  const dropdownRef = useRef(null);

  // Orçamentos etapas
  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', organizacao_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('etapa_obra')
        .select('id, nome_etapa, codigo_etapa')
        .eq('organizacao_id', organizacao_id)
        .order('codigo_etapa');
      return data || [];
    },
    enabled: !!organizacao_id,
    staleTime: 10 * 60 * 1000,
  });

  // BIM: grupos + controles
  const {
    empreendimentosAgrupados, carregandoEmpreendimentos,
    empreendimentoSelecionadoId, empreendimentoSelecionado, handleSelectEmpreendimento,
    modelos, carregandoModelos,
    modeloSelecionadoId, modeloSelecionado, handleSelectModelo,
    grupos, carregandoElementos, kpis,
    categoriasExpandidas, toggleCategoria, expandirTodas, recolherTodas,
    todosElementos,              // flat do modelo selecionado (para o modal de preview)
    todosElementosEmpreendimento, // flat de TODOS os modelos do empreendimento (para Por Material)
    carregandoElementosEmp,
  } = useBimQuantitativos({ organizacaoId: organizacao_id });

  // Mapeamentos BIM → Materiais
  // Usa todosElementosEmpreendimento para somar TODOS os modelos do empreendimento
  const {
    mapeamentos,
    criarMapeamento,
    deletarMapeamento,
    resolverMapeamento,
    quantitativoPorMaterial,
    carregandoQuantitativoPorMaterial,
    propriedadesMapeadas,
    kpisMaterial,
  } = useBimMapeamentos({
    organizacaoId: organizacao_id,
    empreendimentoId: empreendimentoSelecionadoId,
  });

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handle = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownEmpAberto(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Reset medidas + expansão ao trocar modelo
  useEffect(() => {
    setMedidasSelecionadas({});
  }, [modeloSelecionadoId]);

  // Estado para elementos expandidos (chave = 'cat|||fam|||tipo')
  const [tiposExpandidos, setTiposExpandidos] = useState(new Set());
  const toggleTipoExpandido = (chave) => setTiposExpandidos(prev => {
    const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s;
  });

  // Estado para famílias expandidas dentro de uma categoria
  const [familiasExpandidas, setFamiliasExpandidas] = useState(new Set());
  const toggleFamiliaExpandida = (chave) => setFamiliasExpandidas(prev => {
    const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s;
  });

  // Helper: chave única por tipo
  const tipoChave = (cat, fam, tipo) => `${cat}|||${fam}|||${tipo}`;

  // Helper: obtém a medida ativa de um tipo
  const getMedidaAtiva = (cat, fam, t) => {
    const chave = tipoChave(cat, fam, t.tipo);
    const escolhida = medidasSelecionadas[chave];
    if (escolhida && t.medidas.find(m => m.chave === escolhida)) {
      return t.medidas.find(m => m.chave === escolhida);
    }
    return t.medidas[0] || null;
  };

  // Badge padronizado para unidade (mesma aparência, cor por tipo)
  const UNIDADE_COR = {
    'm³': 'bg-purple-50 text-purple-700 border-purple-200',
    'm²': 'bg-green-50 text-green-700 border-green-200',
    'm':  'bg-blue-50 text-blue-700 border-blue-200',
    'mm': 'bg-orange-100 text-orange-600 border-orange-200',
    'un': 'bg-gray-50 text-gray-600 border-gray-200',
  };
  const BadgeUnidade = ({ unidade, ativo = true, onClick }) => {
    const cor = UNIDADE_COR[unidade] || UNIDADE_COR['un'];
    const base = `text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all`;
    const estado = ativo
      ? `${cor} ring-2 ring-offset-1 ring-current/20`
      : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600';
    return onClick
      ? <button onClick={onClick} className={`${base} ${estado} cursor-pointer`}>{unidade}</button>
      : <span className={`${base} ${cor}`}>{unidade}</span>;
  };

  // ─── Sidebar de detalhes ─────────────────────────────────────────────────
  const [sidebarItem, setSidebarItem] = useState(null);
  // sidebarItem = { tipo: 'familia' | 'tipo' | 'elemento', dados: {...}, cat, fam }

  const fecharSidebar = () => setSidebarItem(null);

  // Ao trocar modelo, fecha sidebar
  useEffect(() => { setSidebarItem(null); }, [modeloSelecionadoId]);

  // Filtra grupos por busca — agora com estrutura 3 níveis
  const gruposFiltrados = useMemo(() => {
    if (!buscaElemento.trim()) return grupos;
    const termo = buscaElemento.toLowerCase();
    return grupos
      .map(cat => ({
        ...cat,
        familias: cat.familias
          .map(f => ({
            ...f,
            tipos: f.tipos.filter(t =>
              f.familia.toLowerCase().includes(termo) ||
              t.tipo.toLowerCase().includes(termo) ||
              (t.sinapi_revit && t.sinapi_revit.toLowerCase().includes(termo))
            ),
          }))
          .filter(f => f.tipos.length > 0),
      }))
      .filter(cat => cat.familias.length > 0);
  }, [grupos, buscaElemento]);

  // Helper: soma medidas de uma lista de tipos
  const somarMedidas = (tipos) => {
    const acum = {};
    tipos.forEach(t => {
      t.medidas.forEach(m => {
        if (!acum[m.chave]) acum[m.chave] = { ...m, valor: 0, qtd_com_valor: 0 };
        acum[m.chave].valor += m.valor;
        acum[m.chave].qtd_com_valor += m.qtd_com_valor;
      });
    });
    return Object.values(acum).sort((a, b) => b.qtd_com_valor - a.qtd_com_valor);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Componente Sidebar de Detalhes (inline)
  // ─────────────────────────────────────────────────────────────────────────
  const SidebarDetalhes = () => {
    if (!sidebarItem) return null;
    const { tipo: nivel, dados, cat, fam } = sidebarItem;

    // Cor do cabeçalho por nível
    const headerCor = nivel === 'familia' ? 'bg-blue-600'
                    : nivel === 'tipo'    ? 'bg-indigo-600'
                    : 'bg-amber-600';

    // Título dinâmico
    const titulo = nivel === 'familia' ? `Família: ${dados.familia}`
                 : nivel === 'tipo'    ? `Tipo: ${dados.tipo}`
                 : `Elemento: ${dados.external_id}`;

    // Calcula medidas a exibir
    const medidasExibir = nivel === 'familia'
      ? somarMedidas(dados.tipos)
      : nivel === 'tipo'
      ? dados.medidas
      : []; // Elementos: exibe propriedades brutas

    const props = nivel === 'elemento' ? (dados.propriedades || {}) : null;
    const propKeys = props ? Object.keys(props).sort() : [];

    return (
      <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-slide-in-right">
        {/* Header */}
        <div className={`${headerCor} text-white px-5 py-4 flex items-start justify-between`}>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-75">
              {cat}{fam ? ` › ${fam}` : ''}
            </p>
            <h2 className="text-sm font-bold mt-0.5 leading-snug">{titulo}</h2>
          </div>
          <button
            onClick={fecharSidebar}
            className="text-white/70 hover:text-white text-lg leading-none ml-4 mt-0.5 hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-all"
          >×</button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">

          {/* Medidas (para Família e Tipo) */}
          {medidasExibir.length > 0 && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Quantidades</p>
              <div className="grid grid-cols-2 gap-2">
                {medidasExibir.map(m => (
                  <div key={m.chave} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">{m.label}</p>
                    <p className="text-base font-bold text-gray-800 mt-0.5">
                      {fmt2(m.valor)} <span className="text-[10px] font-normal text-gray-400">{m.unidade}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contagem de instâncias */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {nivel === 'familia' ? dados.total_elementos
               : nivel === 'tipo' ? dados.qtd_total
               : 1} inst.
            </span>
            {nivel === 'tipo' && dados.sinapi_revit && (
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded border border-indigo-100 font-mono">
                SINAPI {dados.sinapi_revit}
              </span>
            )}
          </div>

          {/* Para Família: lista os tipos */}
          {nivel === 'familia' && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tipos nesta família</p>
              <div className="space-y-1.5">
                {dados.tipos.map(t => (
                  <button
                    key={t.tipo}
                    onClick={() => setSidebarItem({ tipo: 'tipo', dados: t, cat, fam: dados.familia })}
                    className="w-full text-left bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg px-3 py-2 transition-all"
                  >
                    <p className="text-xs font-semibold text-gray-700">{t.tipo}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {t.qtd_total} inst. &middot; {t.medidas[0] ? `${fmt2(t.medidas[0].valor)} ${t.medidas[0].unidade}` : 'Sem medida'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Para Tipo: lista os elementos */}
          {nivel === 'tipo' && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Elementos individuais</p>
              <div className="space-y-1">
                {dados.elementos.map(el => {
                  const elProps = el.propriedades || {};
                  const medAtiva = dados.medidas[0];
                  const val = medAtiva ? parseFloat(elProps[medAtiva.chave] || 0) : null;
                  return (
                    <button
                      key={el.id}
                      onClick={() => setSidebarItem({ tipo: 'elemento', dados: el, cat, fam })}
                      className="w-full text-left bg-gray-50 hover:bg-amber-50 border border-gray-50 hover:border-amber-200 rounded px-3 py-1.5 transition-all flex items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-mono text-gray-600 truncate">{el.external_id}</span>
                      {val && val > 0 && (
                        <span className="text-[10px] font-bold text-gray-700 shrink-0">{fmt2(val)} {medAtiva.unidade}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Para Elemento: todas as propriedades brutas + botões de vínculo */}
          {nivel === 'elemento' && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Propriedades do Revit</p>
              <div className="space-y-0 border border-gray-100 rounded-lg overflow-hidden">
                {propKeys.map((k, i) => {
                  const jaMapeada = propriedadesMapeadas.has(k);
                  const valNum = parseFloat(props[k]);
                  const temValor = !isNaN(valNum) && valNum > 0;
                  return (
                    <div
                      key={k}
                      className={`flex items-center gap-2 px-3 py-2 text-xs ${
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } group hover:bg-blue-50/50 transition-colors`}
                    >
                      <span className="text-gray-500 font-medium shrink-0 max-w-[40%] truncate" title={k}>{k}</span>
                      <span className="text-gray-800 font-semibold flex-1 text-right truncate" title={String(props[k])}>
                        {String(props[k])}
                      </span>
                      {/* Botões de vínculo — só apareçem quando o campo tem valor numérico */}
                      {temValor && (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {jaMapeada ? (
                            <span className="text-[9px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">
                              vinculado
                            </span>
                          ) : (
                            <button
                              onClick={() => setVinculoModal({
                                propriedade: { nome: k, valor: valNum },
                                elemento: dados,
                              })}
                              title="Vincular ao material"
                              className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-bold transition-all"
                            >
                              📦 vincular
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {propKeys.length === 0 && (
                  <p className="text-xs text-gray-400 p-4 text-center">Nenhuma propriedade registrada.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };



  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">

      {/* Sidebar de detalhes */}
      <SidebarDetalhes />
      {sidebarItem && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={fecharSidebar}
        />
      )}

      {/* ══════════════ HEADER ══════════════ */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <FontAwesomeIcon icon={faCubes} className="text-white text-base" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">BIM Quantitativos</h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Elementos & Quantidades</p>
          </div>
        </div>

        {/* Dropdown de Empreendimento */}
        <div className="flex-1 max-w-lg" ref={dropdownRef}>
          <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
            Empreendimento
          </label>
          <div className="relative">
            <button
              onClick={() => setIsDropdownEmpAberto(!isDropdownEmpAberto)}
              className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {empreendimentoSelecionado ? (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-gray-800 truncate">{empreendimentoSelecionado.nome}</span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase">
                    {empreendimentoSelecionado.empresa?.nome_fantasia || 'Sem Empresa'}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">-- Selecione um empreendimento --</span>
              )}
              <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-xs ml-2 transition-transform ${isDropdownEmpAberto ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownEmpAberto && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto p-1">
                {carregandoEmpreendimentos ? (
                  <div className="p-4 text-center text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>
                ) : empreendimentosAgrupados.map(grupo => (
                  <div key={grupo.empresa} className="p-2">
                    <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2 pl-1">
                      <FontAwesomeIcon icon={faBuilding} className="mr-1" />
                      {grupo.empresa}
                    </h3>
                    <div className="space-y-1">
                      {grupo.empreendimentos.map(emp => {
                        const isSel = String(empreendimentoSelecionadoId) === String(emp.id);
                        return (
                          <button
                            key={emp.id}
                            onClick={() => { handleSelectEmpreendimento(String(emp.id)); setIsDropdownEmpAberto(false); }}
                            className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm
                              ${isSel ? 'bg-blue-50 border-blue-200 font-bold text-blue-800' : 'border-transparent hover:bg-gray-50 text-gray-700'}`}
                          >
                            {emp.nome}
                            {isSel && <FontAwesomeIcon icon={faCheck} className="text-blue-500 text-xs" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ações direita do header */}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/bim-manager" className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm" title="Abrir Viewer BIM">
            <FontAwesomeIcon icon={faHome} />
          </Link>
          {modeloSelecionadoId && empreendimentoSelecionadoId && (
            <button
              onClick={() => setIsBimModalAberto(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              <FontAwesomeIcon icon={faArrowRight} />
              Enviar para Orçamento
            </button>
          )}
        </div>
      </header>

      {/* ══════════════ CORPO SPLIT ══════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── ESQUERDA (1/4): Lista de Modelos BIM ─── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Modelos BIM
              {modelos.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{modelos.length}</span>}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {carregandoModelos ? (
              <div className="flex justify-center py-10 text-blue-400">
                <FontAwesomeIcon icon={faSpinner} spin size="lg" />
              </div>
            ) : !empreendimentoSelecionadoId ? (
              <div className="text-center py-10 text-gray-400 text-sm px-4">
                <FontAwesomeIcon icon={faBuilding} className="text-3xl mb-2 text-gray-200" />
                <p>Selecione um empreendimento para ver os modelos BIM.</p>
              </div>
            ) : modelos.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm px-4">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl mb-2 text-amber-300" />
                <p>Nenhum modelo BIM encontrado para este empreendimento.</p>
                <Link href="/bim-manager" className="text-xs text-blue-500 mt-2 inline-block hover:underline">
                  Fazer upload no BIM Manager →
                </Link>
              </div>
            ) : modelos.map(modelo => {
              const isSel = String(modeloSelecionadoId) === String(modelo.id);
              return (
                <button
                  key={modelo.id}
                  onClick={() => handleSelectModelo(modelo.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200
                    ${isSel
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                      ${isSel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <FontAwesomeIcon icon={faCubes} className="text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold leading-tight truncate ${isSel ? 'text-blue-800' : 'text-gray-700'}`} title={modelo.nome_arquivo}>
                        {modelo.nome_arquivo}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {modelo.disciplinas_projetos?.nome && (
                          <span className="text-[9px] text-gray-500 font-medium">{modelo.disciplinas_projetos.nome}</span>
                        )}
                        {modelo.versao && (
                          <span className="text-[9px] text-gray-400">v{modelo.versao}</span>
                        )}
                        <BadgeStatus status={modelo.status} />
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1">{fmtData(modelo.criado_em)}</p>
                    </div>
                    {isSel && <FontAwesomeIcon icon={faCheck} className="text-blue-500 text-xs flex-shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ─── DIREITA (3/4): Tabela de Elementos ─── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* KPIs + Barra de Ações */}
          {modeloSelecionado && (
            <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-800 truncate">{modeloSelecionado.nome_arquivo}</h2>
                  <p className="text-xs text-gray-400">Sincronizado em {fmtData(modeloSelecionado.criado_em)}</p>
                </div>
                {/* Controles de Expansão + Busca */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-2.5 top-2 text-gray-300 text-xs" />
                    <input
                      type="text"
                      value={buscaElemento}
                      onChange={e => setBuscaElemento(e.target.value)}
                      placeholder="Buscar família, tipo, SINAPI..."
                      className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
                    />
                  </div>
                  <button
                    onClick={expandirTodas}
                    title="Expandir tudo"
                    className="p-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <FontAwesomeIcon icon={faExpand} />
                  </button>
                  <button
                    onClick={recolherTodas}
                    title="Recolher tudo"
                    className="p-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <FontAwesomeIcon icon={faCompress} />
                  </button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Elementos</p>
                  <p className="text-lg font-bold text-blue-800">{kpis.totalElementos.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Categorias</p>
                  <p className="text-lg font-bold text-gray-700">{kpis.totalCategorias}</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-black text-green-600 uppercase tracking-wider">
                    <FontAwesomeIcon icon={faRulerCombined} className="mr-1" />Área Total m²
                  </p>
                  <p className="text-lg font-bold text-green-700">{fmt2(kpis.areaTotal)}</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">
                    <FontAwesomeIcon icon={faBarcode} className="mr-1" />Com SINAPI
                  </p>
                  <p className="text-lg font-bold text-indigo-700">{kpis.comSinapi}</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── TABS: Elementos BIM | Por Material ─── */}
          {modeloSelecionado && (
            <div className="flex border-b border-gray-200 bg-white px-5 flex-shrink-0">
              {[{ v: 'elementos', label: 'Elementos BIM' }, { v: 'por-material', label: `📦 Orçamentação${kpisMaterial.totalMapeados > 0 ? ` (${kpisMaterial.totalMapeados})` : ''}` }]
                .map(tab => (
                  <button
                    key={tab.v}
                    onClick={() => setAbaAtiva(tab.v)}
                    className={`px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                      abaAtiva === tab.v
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {tab.v === 'por-material' && kpisMaterial.materialComAlerta > 0 && (
                      <span className="ml-1.5 bg-amber-100 text-amber-600 text-[9px] font-black px-1 py-0.5 rounded-full">
                        {kpisMaterial.materialComAlerta} ⚠️
                      </span>
                    )}
                  </button>
                ))
              }
            </div>
          )}

          {/* Tabela de Elementos */}
          <div className="flex-1 overflow-y-auto">
            {/* ─── ABA: POR MATERIAL ─── */}
            {abaAtiva === 'por-material' && (
              <div className="p-5">
                {quantitativoPorMaterial.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <span className="text-5xl">📦</span>
                    <p className="font-semibold text-center">
                      Nenhum material vinculado ainda.<br />
                      <span className="text-xs">Abra um elemento no sidebar e clique em "📦 vincular" numa propriedade.</span>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Banner: escopo do empreendimento inteiro */}
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      {carregandoQuantitativoPorMaterial ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin className="text-blue-400 text-xs" />
                          <span>Calculando quantitativos do empreendimento...</span>
                        </>
                      ) : (
                        <>
                          <span>🏗️</span>
                          <span>
                            <strong>{empreendimentoSelecionado?.nome}</strong>
                            {' · '}{modelos.length} modelo{modelos.length !== 1 ? 's' : ''} BIM
                            {' · '}<strong>{todosElementosEmpreendimento.length.toLocaleString('pt-BR')}</strong> elementos
                          </span>
                        </>
                      )}
                    </div>

                    {/* KPIs materiais */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Custo Estimado</p>
                        <p className="text-lg font-bold text-emerald-800">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpisMaterial.custoTotal)}
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Materiais Mapeados</p>
                        <p className="text-lg font-bold text-blue-800">{kpisMaterial.totalMapeados}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Alertas de Sync</p>
                        <p className="text-lg font-bold text-amber-800">{kpisMaterial.materialComAlerta}</p>
                      </div>
                    </div>

                    {/* Tabela de quantitativos por material */}
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Material</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Unid.</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Quantidade</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">R$ Unit.</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Est.</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Elem.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quantitativoPorMaterial.map(item => (
                          <tr
                            key={item.key}
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              item.tem_alertas ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {item.tem_alertas && (
                                  <span title={`${item.external_ids_inativos.length} elementos removidos do modelo`}>
                                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-400 text-xs" />
                                  </span>
                                )}
                                <div>
                                  <p className="text-xs font-bold text-gray-800">{item.nome}</p>
                                  {item.tem_alertas && (
                                    <p className="text-[9px] text-amber-600">
                                      {item.external_ids_inativos.length} elemento{item.external_ids_inativos.length !== 1 ? 's' : ''} removido{item.external_ids_inativos.length !== 1 ? 's' : ''} do modelo
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <BadgeUnidade unidade={item.unidade} />
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">
                              {fmt2(item.quantidade)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 text-xs">
                              {item.preco_unitario > 0
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.preco_unitario > 0 ? (
                                <span className="font-bold text-emerald-700">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.custo_total)}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {item.qtd_elementos}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {quantitativoPorMaterial.some(m => m.preco_unitario > 0) && (
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td colSpan={4} className="px-4 py-2.5 text-xs font-black text-gray-600 uppercase tracking-wide">Total Estimado</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpisMaterial.custoTotal)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </>
                )}
              </div>
            )}

            {/* ─── ABA: ELEMENTOS BIM (original) ─── */}
            {(abaAtiva === 'elementos' || !modeloSelecionado) && (
              <>
                {carregandoElementos ? (
                  <div className="flex flex-col items-center justify-center h-full text-blue-400 gap-3">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                    <p className="text-sm text-gray-500">Carregando elementos BIM...</p>
                  </div>
                ) : !modeloSelecionadoId ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <FontAwesomeIcon icon={faCubes} className="text-5xl text-gray-200" />
                    <p className="font-semibold">Selecione um modelo BIM à esquerda para visualizar os elementos.</p>
                  </div>
                ) : gruposFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <FontAwesomeIcon icon={faBoxOpen} className="text-5xl text-gray-200" />
                    <p className="font-semibold">Nenhum elemento encontrado{buscaElemento ? ' para a busca realizada' : ' neste modelo'}.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-10"></th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Família / Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nível</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Inst.</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unidade</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Quantidade</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">SINAPI Revit</th>
                      </tr>
                    </thead>
                    <tbody>
                  {gruposFiltrados.map(cat => {
                    const catExpandida = categoriasExpandidas.has(cat.categoria);
                    return (
                      <>
                        {/* ── L1: Categoria ── */}
                        <tr
                          key={`cat-${cat.categoria}`}
                          onClick={() => toggleCategoria(cat.categoria)}
                          className="bg-gray-200 cursor-pointer hover:bg-gray-300 transition-colors border-t-2 border-gray-300"
                        >
                          <td className="px-3 py-2.5 text-center">
                            <FontAwesomeIcon icon={catExpandida ? faAngleDown : faAngleRight} className="text-gray-500" />
                          </td>
                          <td className="px-4 py-2.5 font-bold text-gray-700 text-xs uppercase tracking-wide" colSpan={4}>
                            <FontAwesomeIcon icon={faLayerGroup} className="mr-2 text-blue-500" />
                            {cat.categoria}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-600">
                            {cat.total_elementos.toLocaleString('pt-BR')} elem.
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                            {cat.area_total_categoria > 0 ? fmt2(cat.area_total_categoria) + ' m²' : ''}
                          </td>
                        </tr>

                        {catExpandida && cat.familias.map(fam => {
                          const famChave = `${cat.categoria}|||${fam.familia}`;
                          const famExpandida = familiasExpandidas.has(famChave);
                          return (
                            <>
                              {/* ── L2: Família ── */}
                              <tr
                                key={`fam-${famChave}`}
                                className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors border-t border-blue-100"
                              >
                                <td
                                  className="px-3 py-2 text-center pl-7"
                                  onClick={() => toggleFamiliaExpandida(famChave)}
                                >
                                  <FontAwesomeIcon icon={famExpandida ? faAngleDown : faAngleRight} className="text-blue-400 text-xs" />
                                </td>
                                <td
                                  className="px-4 py-2 font-semibold text-blue-800 text-xs"
                                  colSpan={4}
                                  onClick={() => toggleFamiliaExpandida(famChave)}
                                >
                                  {fam.familia}
                                  <span className="ml-2 text-[10px] text-blue-400 font-normal">
                                    {fam.tipos.length} tipo{fam.tipos.length !== 1 ? 's' : ''}
                                  </span>
                                </td>
                                <td
                                  className="px-4 py-2 text-center text-xs font-bold text-blue-600"
                                  onClick={() => toggleFamiliaExpandida(famChave)}
                                >
                                  {fam.total_elementos.toLocaleString('pt-BR')}
                                </td>
                                {/* Botão de detalhes da Família */}
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSidebarItem({ tipo: 'familia', dados: fam, cat: cat.categoria, fam: null }); }}
                                    className="text-[9px] text-blue-400 hover:text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                                    title="Ver detalhes da família"
                                  >
                                    detalhes →
                                  </button>
                                </td>
                              </tr>

                              {famExpandida && fam.tipos.map((t, idx) => {
                                const tChave = tipoChave(cat.categoria, fam.familia, t.tipo);
                                const tExpandido = tiposExpandidos.has(tChave);
                                const medidaAtiva = getMedidaAtiva(cat.categoria, fam.familia, t);
                                const temMultiplas = t.medidas.length > 1;
                                return (
                                  <>
                                    {/* ── L3: Tipo ── */}
                                    <tr
                                      key={`tipo-${tChave}`}
                                      className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group"
                                    >
                                      <td className="px-3 py-2 text-center pl-12">
                                        <button
                                          onClick={() => toggleTipoExpandido(tChave)}
                                          className="w-5 h-5 rounded hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition-all flex items-center justify-center mx-auto"
                                          title="Expandir elementos individuais"
                                        >
                                          <FontAwesomeIcon icon={tExpandido ? faAngleDown : faAngleRight} className="text-xs" />
                                        </button>
                                      </td>
                                      {/* Nome do tipo — clica para abrir sidebar */}
                                      <td
                                        className="px-4 py-2 text-xs text-gray-700 cursor-pointer hover:text-blue-700"
                                        onClick={() => setSidebarItem({ tipo: 'tipo', dados: t, cat: cat.categoria, fam: fam.familia })}
                                      >
                                        {t.tipo === '(sem tipo)' ? <em className="text-gray-400">sem tipo</em> : t.tipo}
                                      </td>
                                      <td className="px-4 py-2 text-[10px] text-gray-400">{t.nivel}</td>
                                      <td className="px-4 py-2 text-center">
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                          {t.qtd_total}
                                        </span>
                                      </td>
                                      {/* Unidade — badge padronizado */}
                                      <td className="px-4 py-2">
                                        {t.medidas.length === 0 ? (
                                          <BadgeUnidade unidade="un" />
                                        ) : temMultiplas ? (
                                          <div className="flex flex-wrap gap-1">
                                            {t.medidas.map(m => (
                                              <BadgeUnidade
                                                key={m.chave}
                                                unidade={m.unidade}
                                                ativo={medidaAtiva?.chave === m.chave}
                                                onClick={() => setMedidasSelecionadas(prev => ({ ...prev, [tChave]: m.chave }))}
                                              />
                                            ))}
                                          </div>
                                        ) : (
                                          <BadgeUnidade unidade={medidaAtiva?.unidade || 'un'} />
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <span className="text-sm font-bold text-gray-800">
                                          {medidaAtiva ? fmt2(medidaAtiva.valor) : t.qtd_total}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">
                                        {t.sinapi_revit
                                          ? <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">{t.sinapi_revit}</span>
                                          : <span className="text-gray-200 text-[10px]">—</span>}
                                      </td>
                                    </tr>

                                    {/* ── L4: Elementos individuais ── */}
                                    {tExpandido && t.elementos.map(el => {
                                      const props = el.propriedades || {};
                                      const valorEl = medidaAtiva ? parseFloat(props[medidaAtiva.chave] || 0) : null;
                                      return (
                                        <tr key={`el-${el.id}`} className="border-b border-gray-50 bg-amber-50/20 hover:bg-amber-50/40">
                                          <td className="px-3 py-1.5 pl-16 text-gray-300 text-center">·</td>
                                          <td className="px-4 py-1.5 text-[10px] text-gray-500">
                                            ID: <span className="font-mono text-gray-600">{el.external_id}</span>
                                          </td>
                                          <td className="px-4 py-1.5 text-[10px] text-gray-400">{el.nivel || '—'}</td>
                                          <td className="px-4 py-1.5 text-center text-[10px] text-gray-400">1</td>
                                          <td className="px-4 py-1.5">
                                            {medidaAtiva && <BadgeUnidade unidade={medidaAtiva.unidade} />}
                                          </td>
                                          <td className="px-4 py-1.5 text-right text-[10px] text-gray-600 font-medium">
                                            {valorEl && valorEl > 0 ? fmt2(valorEl) : '—'}
                                          </td>
                                          <td className="px-4 py-1.5">
                                            {props['SINAPI'] && <span className="text-[9px] font-mono text-indigo-400">{props['SINAPI']}</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </>
                                );
                              })}
                            </>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ─── MODAL: Vincular Propriedade BIM ao Material ─── */}
      <BimVinculoMaterialModal
        isOpen={!!vinculoModal}
        onClose={() => setVinculoModal(null)}
        propriedade={vinculoModal?.propriedade}
        elemento={vinculoModal?.elemento}
        todosElementos={todosElementos}
        organizacaoId={organizacao_id}
        onSalvar={criarMapeamento}
        onExcluir={deletarMapeamento}
        mapeamentoExistente={vinculoModal ? resolverMapeamento(vinculoModal.elemento, vinculoModal.propriedade.nome) : null}
      />

      {/* ─── MODAL BIM IMPORT ─── */}
      {isBimModalAberto && (
        <BimImportModal
          isOpen={isBimModalAberto}
          onClose={() => setIsBimModalAberto(false)}
          empreendimentoId={empreendimentoSelecionadoId}
          orcamentoId={null}
          organizacaoId={organizacao_id}
          etapas={etapas}
        />
      )}
    </div>
  );
}

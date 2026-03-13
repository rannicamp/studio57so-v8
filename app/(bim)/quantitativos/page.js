'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCubes, faChevronDown, faChevronRight, faSpinner, faHome,
  faBuilding, faCheck, faLayerGroup, faRuler, faRulerCombined,
  faFileExport, faArrowRight, faAngleDown, faAngleRight,
  faTriangleExclamation, faBoxOpen, faExpand, faCompress,
  faSearch, faBarcode,
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useBimQuantitativos } from '@/hooks/bim/useBimQuantitativos';
import BimImportModal from '@/components/orcamento/BimImportModal';
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
  const dropdownRef = useRef(null);

  // Etapas para o BimImportModal
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

  // Orçamentos do empreendimento selecionado (para importar)
  const {
    empreendimentosAgrupados, carregandoEmpreendimentos,
    empreendimentoSelecionadoId, empreendimentoSelecionado, handleSelectEmpreendimento,
    modelos, carregandoModelos,
    modeloSelecionadoId, modeloSelecionado, handleSelectModelo,
    grupos, carregandoElementos, kpis,
    categoriasExpandidas, toggleCategoria, expandirTodas, recolherTodas,
  } = useBimQuantitativos({ organizacaoId: organizacao_id });

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handle = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownEmpAberto(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Filtra grupos por busca de texto
  const gruposFiltrados = useMemo(() => {
    if (!buscaElemento.trim()) return grupos;
    const termo = buscaElemento.toLowerCase();
    return grupos
      .map(cat => ({
        ...cat,
        grupos: cat.grupos.filter(g =>
          g.familia.toLowerCase().includes(termo) ||
          g.tipo.toLowerCase().includes(termo) ||
          (g.sinapi_revit && g.sinapi_revit.toLowerCase().includes(termo))
        ),
      }))
      .filter(cat => cat.grupos.length > 0);
  }, [grupos, buscaElemento]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">

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

          {/* Tabela de Elementos */}
          <div className="flex-1 overflow-y-auto">
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
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Família / Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Nível</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Qtd Elem.</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Área (m²)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Volume (m³)</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">SINAPI Revit</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposFiltrados.map(cat => {
                    const expandido = categoriasExpandidas.has(cat.categoria);
                    return (
                      <>
                        {/* ── Cabeçalho da Categoria ── */}
                        <tr
                          key={`cat-${cat.categoria}`}
                          onClick={() => toggleCategoria(cat.categoria)}
                          className="bg-gray-200 cursor-pointer hover:bg-gray-300 transition-colors border-t-2 border-gray-300"
                        >
                          <td className="px-4 py-2.5 text-center">
                            <FontAwesomeIcon
                              icon={expandido ? faAngleDown : faAngleRight}
                              className="text-gray-500"
                            />
                          </td>
                          <td className="px-4 py-2.5 font-bold text-gray-700 text-xs uppercase tracking-wide" colSpan={2}>
                            <FontAwesomeIcon icon={faLayerGroup} className="mr-2 text-blue-500" />
                            {cat.categoria}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-600">
                            {cat.total_elementos.toLocaleString('pt-BR')} elem.
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                            {cat.area_total_categoria > 0 ? fmt2(cat.area_total_categoria) + ' m²' : '—'}
                          </td>
                          <td colSpan={2} className="px-4 py-2.5"></td>
                        </tr>

                        {/* ── Linhas de Família/Tipo ── */}
                        {expandido && cat.grupos.map((g, idx) => (
                          <tr
                            key={`${cat.categoria}-${g.familia}-${g.tipo}-${idx}`}
                            className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group"
                          >
                            <td className="px-4 py-2.5 text-center text-gray-300">
                              <FontAwesomeIcon icon={faAngleRight} className="text-xs" />
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-gray-800 text-xs leading-tight">{g.familia}</p>
                              {g.tipo && g.tipo !== g.familia && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{g.tipo}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500">{g.nivel}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {g.elementos.length}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-700 font-medium">
                              {g.area_total > 0 ? fmt2(g.area_total) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                              {g.volume_total > 0 ? fmt2(g.volume_total) : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              {g.sinapi_revit ? (
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono">
                                  {g.sinapi_revit}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* ══════════════ MODAL BIM IMPORT ══════════════ */}
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

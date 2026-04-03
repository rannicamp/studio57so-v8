// Caminho: components/orcamento/BimImportModal.js
'use client';

import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faTimes, faSpinner, faBuilding, faChevronRight, faChevronLeft,
 faCheck, faCubes, faLayerGroup, faCheckSquare, faSquare,
 faArrowRight, faTriangleExclamation, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { useBimOrcamento } from '@/hooks/bim/useBimOrcamento';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatQtd = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const BADGE_RELEVANCIA = {
 alta: 'bg-green-50 text-green-700 border border-green-200',
 media: 'bg-amber-50 text-amber-700 border border-amber-200',
 baixa: 'bg-gray-50 text-gray-500 border border-gray-200',
};

export default function BimImportModal({
 isOpen,
 onClose,
 empreendimentoId,
 orcamentoId,
 organizacaoId,
 etapas = [],
}) {
 const supabase = createClient();

 const {
 passo, setPasso,
 modelos, carregandoModelos, modeloSelecionado, setModeloSelecionado,
 categoriasDisponiveis, carregandoCategorias, categoriasSelecionadas, setCategoriasSelecionadas,
 carregarGrupos, carregandoGrupos,
 grupos, atualizarGrupo, totalEstimado, gruposIncluidos,
 confirmarImportacao, confirmando,
 resetar,
 } = useBimOrcamento({ empreendimentoId, orcamentoId, organizacaoId });

 // Busca subetapas para o select de etapa
 const { data: subetapas = [] } = useQuery({
 queryKey: ['subetapas', organizacaoId],
 queryFn: async () => {
 const { data } = await supabase.from('subetapas').select('id, nome_subetapa, etapa_id').eq('organizacao_id', organizacaoId);
 return data || [];
 },
 enabled: !!organizacaoId && isOpen,
 staleTime: 5 * 60 * 1000,
 });

 // Reseta ao fechar
 useEffect(() => {
 if (!isOpen) resetar();
 }, [isOpen, resetar]);

 if (!isOpen) return null;

 const toggleCategoria = (nome) => {
 setCategoriasSelecionadas(prev =>
 prev.includes(nome) ? prev.filter(c => c !== nome) : [...prev, nome]
 );
 };

 const toggleTodas = () => {
 if (categoriasSelecionadas.length === categoriasDisponiveis.length) {
 setCategoriasSelecionadas([]);
 } else {
 setCategoriasSelecionadas(categoriasDisponiveis.map(c => c.nome));
 }
 };

 // ────────────────────────────────────── RENDERIZAÇÃO DOS PASSOS

 // ----- PASSO 1: Selecionar Modelo -----
 const renderPasso1 = () => (
 <div className="flex flex-col gap-3">
 {carregandoModelos ? (
 <div className="flex justify-center items-center py-16 text-blue-500">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" />
 </div>
 ) : modelos.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 gap-3">
 <FontAwesomeIcon icon={faTriangleExclamation} className="text-4xl text-amber-400" />
 <p className="font-semibold text-gray-600">Nenhum modelo BIM associado a este empreendimento.</p>
 <p className="text-sm">Faça o upload de um modelo BIM no módulo BIM Manager primeiro.</p>
 </div>
 ) : (
 modelos.map(modelo => (
 <div
 key={modelo.id}
 onClick={() => setModeloSelecionado(modelo)}
 className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
 ${modeloSelecionado?.id === modelo.id
 ? 'border-blue-500 bg-blue-50 shadow-md'
 : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
 }`}
 >
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
 ${modeloSelecionado?.id === modelo.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
 <FontAwesomeIcon icon={faCubes} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-gray-800 text-sm truncate">{modelo.nome_arquivo}</p>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 {modelo.disciplinas_projetos?.nome && (
 <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
 {modelo.disciplinas_projetos.nome}
 </span>
 )}
 {modelo.versao && (
 <span className="text-[10px] text-gray-500 font-medium">v{modelo.versao}</span>
 )}
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
 ${modelo.status === 'processado' || modelo.status === 'ativo'
 ? 'bg-green-50 text-green-700 border border-green-200'
 : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
 {modelo.status || 'Disponível'}
 </span>
 </div>
 </div>
 {modeloSelecionado?.id === modelo.id && (
 <FontAwesomeIcon icon={faCheck} className="text-blue-500 flex-shrink-0" />
 )}
 </div>
 ))
 )}
 </div>
 );

 // ----- PASSO 2: Selecionar Categorias -----
 const renderPasso2 = () => (
 <div className="flex flex-col gap-3">
 {carregandoCategorias ? (
 <div className="flex justify-center items-center py-16 text-blue-500">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" />
 </div>
 ) : (
 <>
 <div
 onClick={toggleTodas}
 className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-dashed border-gray-300 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all"
 >
 <FontAwesomeIcon
 icon={categoriasSelecionadas.length === categoriasDisponiveis.length ? faCheckSquare : faSquare}
 className={categoriasSelecionadas.length === categoriasDisponiveis.length ? 'text-blue-500' : 'text-gray-400'}
 />
 <span className="text-sm font-bold text-gray-700">
 {categoriasSelecionadas.length === categoriasDisponiveis.length ? 'Desmarcar todas' : 'Selecionar todas'}
 </span>
 </div>

 {categoriasDisponiveis.map(cat => (
 <div
 key={cat.nome}
 onClick={() => toggleCategoria(cat.nome)}
 className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
 ${categoriasSelecionadas.includes(cat.nome)
 ? 'border-blue-400 bg-blue-50'
 : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/20'
 }`}
 >
 <FontAwesomeIcon
 icon={categoriasSelecionadas.includes(cat.nome) ? faCheckSquare : faSquare}
 className={categoriasSelecionadas.includes(cat.nome) ? 'text-blue-500' : 'text-gray-300'}
 />
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-gray-800 text-sm">{cat.nome}</p>
 <p className="text-xs text-gray-500">{cat.total} elemento(s) • {cat.unidade_sugerida}</p>
 </div>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${BADGE_RELEVANCIA[cat.relevancia]}`}>
 {cat.relevancia}
 </span>
 </div>
 ))}
 </>
 )}
 </div>
 );

 // ----- PASSO 3: Revisar Grupos -----
 const renderPasso3 = () => (
 <div className="flex flex-col gap-2">
 {grupos.length === 0 ? (
 <div className="text-center py-12 text-gray-400">
 <FontAwesomeIcon icon={faLayerGroup} className="text-4xl mb-3" />
 <p className="font-semibold">Nenhum grupo encontrado para as categorias selecionadas.</p>
 </div>
 ) : (
 <>
 <p className="text-xs text-gray-500 font-medium mb-1">
 Revise as quantidades, preencha o preço unitário e a etapa. Desmarque itens que não deseja importar.
 </p>
 <div className="overflow-x-auto rounded-lg border border-gray-200">
 <table className="min-w-full text-sm">
 <thead className="bg-gray-50 border-b border-gray-200">
 <tr>
 <th className="px-2 py-2 w-8"></th>
 <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Família / Tipo</th>
 <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Qtd</th>
 <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Un</th>
 <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Preço Un.</th>
 <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase min-w-[140px]">Etapa</th>
 <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {grupos.map((g) => (
 <tr
 key={g.chave}
 className={`transition-colors ${g.incluir ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 opacity-50'}`}
 >
 <td className="px-2 py-2 text-center">
 <input
 type="checkbox"
 checked={g.incluir}
 onChange={(e) => atualizarGrupo(g.chave, 'incluir', e.target.checked)}
 className="w-4 h-4 text-blue-600 rounded cursor-pointer"
 />
 </td>
 <td className="px-3 py-2">
 <p className="font-semibold text-gray-800 text-xs leading-tight">{g.familia}</p>
 {g.tipo && g.tipo !== 'Sem Tipo' && (
 <p className="text-[10px] text-gray-500">{g.tipo}</p>
 )}
 <p className="text-[9px] text-blue-500 mt-0.5">{g.quantidade_elementos} elem.</p>
 </td>
 <td className="px-3 py-2 text-center">
 <input
 type="number"
 min="0"
 step="0.01"
 value={g.quantidade_editavel}
 onChange={(e) => atualizarGrupo(g.chave, 'quantidade_editavel', parseFloat(e.target.value) || 0)}
 disabled={!g.incluir}
 className="w-20 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2 text-center">
 <input
 type="text"
 value={g.unidade}
 onChange={(e) => atualizarGrupo(g.chave, 'unidade', e.target.value)}
 disabled={!g.incluir}
 className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2 text-right">
 <input
 type="number"
 min="0"
 step="0.01"
 value={g.preco_unitario}
 onChange={(e) => atualizarGrupo(g.chave, 'preco_unitario', e.target.value)}
 placeholder="0,00"
 disabled={!g.incluir}
 className="w-24 text-right text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
 />
 </td>
 <td className="px-3 py-2">
 <select
 value={g.etapa_id || ''}
 onChange={(e) => atualizarGrupo(g.chave, 'etapa_id', e.target.value || null)}
 disabled={!g.incluir}
 className="w-full text-xs border border-gray-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
 >
 <option value="">— Etapa —</option>
 {etapas.map(e => (
 <option key={e.id} value={e.id}>{e.nome_etapa}</option>
 ))}
 </select>
 </td>
 <td className="px-3 py-2 text-right">
 <span className={`text-xs font-bold ${g.incluir && g.preco_unitario > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
 {formatCurrency(g.quantidade_editavel * (parseFloat(g.preco_unitario) || 0))}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 <tfoot className="bg-gray-100 border-t-2 border-gray-300">
 <tr>
 <td colSpan="6" className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">
 {gruposIncluidos} item(ns) selecionado(s) — Total Estimado:
 </td>
 <td className="px-3 py-2 text-right font-bold text-blue-700">
 {formatCurrency(totalEstimado)}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>
 </>
 )}
 </div>
 );

 // ────────────────────────────────────── RENDER PRINCIPAL

 const passoLabels = ['Escolher Modelo', 'Selecionar Categorias', 'Revisar e Confirmar'];

 const podeAvancarPasso1 = !!modeloSelecionado;
 const podeAvancarPasso2 = categoriasSelecionadas.length > 0;

 return (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

 {/* HEADER */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
 <FontAwesomeIcon icon={faWandMagicSparkles} className="text-white text-sm" />
 </div>
 <div>
 <h3 className="text-base font-bold text-gray-800">Importar do BIM</h3>
 <p className="text-xs text-gray-500">Passo {passo} de 3 — {passoLabels[passo - 1]}</p>
 </div>
 </div>
 <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors">
 <FontAwesomeIcon icon={faTimes} />
 </button>
 </div>

 {/* INDICADOR DE PASSOS */}
 <div className="flex items-center px-6 py-3 bg-gray-50 border-b border-gray-200 gap-2 flex-shrink-0">
 {passoLabels.map((label, i) => {
 const num = i + 1;
 const ativo = passo === num;
 const concluido = passo > num;
 return (
 <div key={num} className="flex items-center gap-2">
 <div className={`flex items-center gap-1.5 text-xs font-semibold transition-all
 ${ativo ? 'text-blue-600' : concluido ? 'text-green-600' : 'text-gray-400'}`}>
 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
 ${ativo ? 'bg-blue-600 text-white' : concluido ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
 {concluido ? <FontAwesomeIcon icon={faCheck} /> : num}
 </div>
 <span className="hidden sm:inline">{label}</span>
 </div>
 {i < 2 && <FontAwesomeIcon icon={faChevronRight} className="text-gray-300 text-xs" />}
 </div>
 );
 })}
 </div>

 {/* CORPO - SCROLLÁVEL */}
 <div className="flex-1 overflow-y-auto p-6">
 {passo === 1 && renderPasso1()}
 {passo === 2 && renderPasso2()}
 {passo === 3 && renderPasso3()}
 </div>

 {/* FOOTER */}
 <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex-shrink-0">
 <button
 onClick={passo === 1 ? onClose : () => setPasso(p => p - 1)}
 className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
 >
 <FontAwesomeIcon icon={passo === 1 ? faTimes : faChevronLeft} />
 {passo === 1 ? 'Cancelar' : 'Voltar'}
 </button>

 {passo < 3 ? (
 <button
 onClick={async () => {
 if (passo === 1 && podeAvancarPasso1) setPasso(2);
 if (passo === 2 && podeAvancarPasso2) await carregarGrupos();
 }}
 disabled={
 (passo === 1 && !podeAvancarPasso1) ||
 (passo === 2 && !podeAvancarPasso2) ||
 carregandoGrupos
 }
 className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-bold px-5 py-2 rounded-lg shadow-sm transition-colors"
 >
 {carregandoGrupos ? (
 <><FontAwesomeIcon icon={faSpinner} spin /> Calculando...</>
 ) : (
 <>Avançar <FontAwesomeIcon icon={faArrowRight} /></>
 )}
 </button>
 ) : (
 <button
 onClick={confirmarImportacao}
 disabled={confirmando || gruposIncluidos === 0}
 className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold px-5 py-2 rounded-lg shadow-sm transition-colors"
 >
 {confirmando ? (
 <><FontAwesomeIcon icon={faSpinner} spin /> Importando...</>
 ) : (
 <><FontAwesomeIcon icon={faCheck} /> Confirmar Importação ({gruposIncluidos})</>
 )}
 </button>
 )}
 </div>
 </div>
 </div>
 );
}

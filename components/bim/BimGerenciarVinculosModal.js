import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, faTrash, faExclamationTriangle, faLink, 
  faBoxOpen, faSave, faSpinner, faDiagramProject, 
  faPen, faCheck, faSearch 
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function BimGerenciarVinculosModal({
  isOpen,
  onClose,
  materialOuSinapi, // O objeto da linha consolidada (com material_id ou sinapi_id e origem)
  mapeamentos, // Array com todos os mapeamentos puxados pelo hook
  onExcluir, // Função async deletarMapeamento
  organizacaoId, // Recebido para busca de materiais próprios
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  const [excluindo, setExcluindo] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('exclusao'); // 'exclusao' | 'composicao'
  const [salvandoFilho, setSalvandoFilho] = useState(false);
  const [novoFilhoSelecaoId, setNovoFilhoSelecaoId] = useState('');

  // Estados de edição / troca de material
  const [mapeamentoEditandoId, setMapeamentoEditandoId] = useState(null);
  const [buscaMaterial, setBuscaMaterial] = useState('');
  const [materialSelecionadoParaTroca, setMaterialSelecionadoParaTroca] = useState(null);
  const [atualizandoMaterial, setAtualizandoMaterial] = useState(false);

  // Busca reativa de materiais propios + SINAPI para a edição/troca inline
  const { data: resultadosBusca = [], isFetching: buscando } = useQuery({
    queryKey: ['bim_busca_material_gerenciar', buscaMaterial, organizacaoId],
    queryFn: async () => {
      if (buscaMaterial.trim().length < 2) return [];
      const termo = `%${buscaMaterial}%`;

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
    enabled: !!materialOuSinapi && !!mapeamentoEditandoId && buscaMaterial.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  if (!isOpen || !materialOuSinapi) return null;

  // Filtra mapeamentos que pertencem DIRETAMENTE a este material (e não a um pai avulso)
  const mapeamentosDesteItem = mapeamentos.filter(m => {
    if (materialOuSinapi.origem === 'sinapi') {
      const mId = m.sinapi?.id || m.sinapi_id;
      return mId && String(mId) === String(materialOuSinapi.sinapi_id) && !m.vinculo_pai_id;
    }
    const mId = m.material?.id || m.material_id;
    return mId && String(mId) === String(materialOuSinapi.material_id) && !m.vinculo_pai_id;
  });

  // Filtra os arquivos "Avulsos" que estão "pendurados" em UM dos mapeamentos deste Pai
  const idsMapeamentosPai = mapeamentosDesteItem.map(m => m.id);
  const filhos = mapeamentos.filter(m => m.vinculo_pai_id && idsMapeamentosPai.includes(m.vinculo_pai_id));

  // Pra evitar complexidade extrema de sub-ramos matemáticos, a Subcomposição será pendurada 
  // no PRIMEIRO mapeamento válido do Pai. Se ele foi atrelado à Parede, penduramos lá.
  const mapeamentoPrincipalPai = mapeamentosDesteItem[0];

  // Extraimos materiais avulsos que podem ser escolhidos como filho (que ainda não foram pendurados em ngm)
  const itensAvulsosOrfaos = mapeamentos.filter(m => m.tipo_vinculo === 'avulso' && !m.vinculo_pai_id);

  // Salvar a troca do material em um mapeamento
  const handleConfirmarTroca = async (mapeamentoId) => {
    if (!materialSelecionadoParaTroca) return;
    try {
      setAtualizandoMaterial(true);
      const isProprio = materialSelecionadoParaTroca.origem === 'proprio';

      const { error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .update({
          material_id: isProprio ? materialSelecionadoParaTroca.id : null,
          sinapi_id: !isProprio ? materialSelecionadoParaTroca.id : null
        })
        .eq('id', mapeamentoId)
        .eq('organizacao_id', organizacaoId);

      if (error) throw error;

      toast.success('Vínculo atualizado com sucesso! Carregamento Mágico ativado.');
      
      // Reseta estados
      setMapeamentoEditandoId(null);
      setMaterialSelecionadoParaTroca(null);
      setBuscaMaterial('');

      // Invalidação mágica do cache para atualizar em background
      queryClient.invalidateQueries({ queryKey: ['bim_mapeamentos'] });
      queryClient.invalidateQueries({ queryKey: ['bim_quantitativos_orcamentacao'] });
      queryClient.invalidateQueries({ queryKey: ['bim_quantitativos_categoria'] });
    } catch (err) {
      toast.error('Erro ao atualizar o material do vínculo.');
      console.error(err);
    } finally {
      setAtualizandoMaterial(false);
    }
  };

  // Excluir todas as regras ligadas a este item
  const handleExcluirTudo = async () => {
    try {
      setExcluindo(true);
      if (mapeamentosDesteItem.length === 0) {
        toast.error('Nenhum vínculo ativo encontrado para este material.');
        return;
      }

      // Executa exclusão de todos os vínculos relacionados
      for (const m of mapeamentosDesteItem) {
        await onExcluir(m.id);
      }
      toast.success('Todos os vínculos do item foram removidos com sucesso!');
      onClose();
    } catch (err) {
      toast.error('Falha ao remover alguns vínculos.');
      console.error(err);
    } finally {
      setExcluindo(false);
    }
  };

  // Excluir uma única regra específica do item
  const handleExcluirIndividual = async (id) => {
    try {
      setExcluindo(true);
      await onExcluir(id);
      toast.success('Regra desvinculada com sucesso!');
      
      // Se não sobrar nenhum mapeamento, fecha o modal
      if (mapeamentosDesteItem.length <= 1) {
        onClose();
      }
    } catch (err) {
      toast.error('Erro ao remover esta regra.');
      console.error(err);
    } finally {
      setExcluindo(false);
    }
  };

  const handlePlugarFilho = async () => {
    if (!novoFilhoSelecaoId || !mapeamentoPrincipalPai) return;

    try {
      setSalvandoFilho(true);
      const { error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .update({ vinculo_pai_id: mapeamentoPrincipalPai.id })
        .eq('id', novoFilhoSelecaoId);

      if (error) throw error;
      toast.success('Insumo atrelado à composição principal com sucesso!');
      setNovoFilhoSelecaoId('');
      onClose(); // fecha para reconstruir
    } catch (err) {
      toast.error('Ocorreu um erro ao atrelar o material.');
      console.error(err);
    } finally {
      setSalvandoFilho(false);
    }
  };

  const handleDesplugarFilho = async (idFilho) => {
    try {
      setExcluindo(true);
      const { error } = await supabase
        .from('bim_mapeamentos_propriedades')
        .update({ vinculo_pai_id: null })
        .eq('id', idFilho);

      if (error) throw error;
      toast.success('Tornado Insumo Avulso novamente.');
      onClose();
    } catch (err) {
      toast.error('Erro ao desatrelar.');
      console.error(err);
    } finally {
      setExcluindo(false);
    }
  };

  // Helper para renderizar escopo de forma visualmente rica
  const renderBadgeEscopo = (escopo) => {
    const cfgs = {
      elemento: { label: 'Instância', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
      tipo: { label: 'Tipo', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      familia: { label: 'Família', cls: 'bg-red-50 text-red-700 border-red-200' },
      categoria: { label: 'Categoria', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      projeto: { label: 'Projeto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    };
    const c = cfgs[escopo] || { label: escopo, cls: 'bg-gray-50 text-gray-700 border-gray-200' };
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.cls}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 bg-slate-50">
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faLink} className="text-lg" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Gerenciar Vínculos e Regras</h2>
              <p className="text-xs font-semibold text-gray-500 mt-1 line-clamp-2">
                {materialOuSinapi.nome}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors flex items-center justify-center -mt-2 -mr-2"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setAbaAtiva('exclusao')}
            className={`flex-1 py-3 text-xs font-bold transition-all relative ${
              abaAtiva === 'exclusao' ? 'text-blue-700 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Configuração do Vínculo
            {abaAtiva === 'exclusao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
          <button
            onClick={() => setAbaAtiva('composicao')}
            className={`flex-1 py-3 text-xs font-bold transition-all relative flex justify-center items-center gap-2 ${
              abaAtiva === 'composicao' ? 'text-blue-700 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Composições Filhas
            {filhos.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full">
                {filhos.length}
              </span>
            )}
            {abaAtiva === 'composicao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex-1 overflow-y-auto max-h-[550px]">
          {abaAtiva === 'exclusao' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              
              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Regras Ativas ({mapeamentosDesteItem.length})
                </h3>

                {mapeamentosDesteItem.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400 text-xl mb-2" />
                    <p className="text-xs font-semibold text-gray-500">Nenhum mapeamento ativo encontrado.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {mapeamentosDesteItem.map(m => {
                      const isEditando = mapeamentoEditandoId === m.id;
                      
                      // Resolve qual texto mostrar dependendo do escopo
                      let escopoDetalhe = '';
                      if (m.escopo === 'categoria') escopoDetalhe = m.categoria_bim;
                      else if (m.escopo === 'familia') escopoDetalhe = `${m.familia_bim} (${m.categoria_bim})`;
                      else if (m.escopo === 'tipo') escopoDetalhe = `${m.tipo_bim} (${m.familia_bim})`;
                      else if (m.escopo === 'elemento') escopoDetalhe = `Instância: ${m.elemento_id} (${m.tipo_bim || m.familia_bim})`;
                      else escopoDetalhe = 'Filtro global';

                      const matNome = m.material?.nome || m.sinapi?.descricao || 'Material não encontrado';
                      const matUnidade = m.material?.unidade_medida || m.sinapi?.unidade_medida || 'un';

                      return (
                        <div key={m.id} className="border border-slate-200 bg-slate-50/50 rounded-xl p-3 flex flex-col transition-all hover:bg-slate-50">
                          {/* Topo do Card de Regra */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                {renderBadgeEscopo(m.escopo)}
                                <span className="text-[11px] font-bold text-gray-700 leading-tight">
                                  {escopoDetalhe}
                                </span>
                              </div>
                              
                              <p className="text-[10px] text-gray-500 font-semibold">
                                Propriedade: <span className="font-mono text-slate-600 bg-slate-200/60 px-1 py-0.5 rounded">{m.propriedade_nome}</span>
                                {m.fator_conversao && ` (Fator: ${m.fator_conversao})`}
                              </p>
                              
                              <p className="text-[11px] text-blue-800 font-bold mt-1">
                                Vinculado a: <span className="text-gray-700 font-medium">{matNome}</span> <span className="text-[9px] bg-slate-200 px-1 py-0.2 rounded font-normal text-gray-500">{matUnidade}</span>
                              </p>
                            </div>

                            {/* Ações da Regra */}
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  if (isEditando) {
                                    setMapeamentoEditandoId(null);
                                    setMaterialSelecionadoParaTroca(null);
                                  } else {
                                    setMapeamentoEditandoId(m.id);
                                    setBuscaMaterial('');
                                    setMaterialSelecionadoParaTroca(null);
                                  }
                                }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs ${
                                  isEditando 
                                    ? 'bg-blue-600 hover:bg-blue-750 text-white' 
                                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-600'
                                }`}
                                title="Trocar Material"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                              
                              <button
                                onClick={() => handleExcluirIndividual(m.id)}
                                disabled={excluindo}
                                className="w-7 h-7 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors text-xs disabled:opacity-50"
                                title="Desvincular esta regra"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                          </div>

                          {/* Seção de Edição/Troca de Material Inline */}
                          {isEditando && (
                            <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                Trocar Material do Vínculo:
                              </label>
                              
                              {/* Campo de Busca */}
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                                  <FontAwesomeIcon icon={faSearch} className="text-xs" />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Digite para buscar material..."
                                  value={buscaMaterial}
                                  onChange={e => {
                                    setBuscaMaterial(e.target.value);
                                    setMaterialSelecionadoParaTroca(null);
                                  }}
                                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                              </div>

                              {/* Resultados da Busca */}
                              {buscaMaterial.trim().length >= 2 && (
                                <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-inner p-1">
                                  {buscando ? (
                                    <div className="text-center py-3 text-[11px] text-gray-400 font-semibold flex justify-center items-center gap-1.5">
                                      <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
                                      Buscando materiais...
                                    </div>
                                  ) : resultadosBusca.length === 0 ? (
                                    <p className="text-center py-3 text-[11px] text-gray-400 font-semibold">
                                      Nenhum material encontrado.
                                    </p>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      {resultadosBusca.map(res => (
                                        <button
                                          key={`${res.origem}_${res.id}`}
                                          onClick={() => setMaterialSelecionadoParaTroca(res)}
                                          className={`w-full text-left text-xs p-2 rounded transition-colors flex items-center justify-between font-medium ${
                                            materialSelecionadoParaTroca?.id === res.id && materialSelecionadoParaTroca?.origem === res.origem
                                              ? 'bg-blue-50 text-blue-700'
                                              : 'hover:bg-slate-50 text-gray-700'
                                          }`}
                                        >
                                          <div className="truncate mr-2">
                                            {res.nome}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[9px] uppercase px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                                              {res.unidade_medida}
                                            </span>
                                            <span className={`text-[8px] font-bold px-1 rounded-full uppercase border ${
                                              res.origem === 'sinapi' 
                                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                              {res.origem}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Material Selecionado */}
                              {materialSelecionadoParaTroca && (
                                <div className="bg-emerald-55 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-850">
                                  <div className="truncate mr-2 font-semibold leading-tight">
                                    Selecionado: {materialSelecionadoParaTroca.nome} ({materialSelecionadoParaTroca.unidade_medida})
                                  </div>
                                  <span className="text-[9px] uppercase px-1.5 py-0.2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded shrink-0 font-bold">
                                    {materialSelecionadoParaTroca.origem === 'sinapi' ? 'SINAPI' : 'Próprio'}
                                  </span>
                                </div>
                              )}

                              {/* Botões de Ação da Edição */}
                              <div className="flex justify-end gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMapeamentoEditandoId(null);
                                    setMaterialSelecionadoParaTroca(null);
                                    setBuscaMaterial('');
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={!materialSelecionadoParaTroca || atualizandoMaterial}
                                  onClick={() => handleConfirmarTroca(m.id)}
                                  className="px-3 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-750 disabled:opacity-50 rounded transition-colors flex items-center gap-1"
                                >
                                  {atualizandoMaterial ? (
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                  ) : (
                                    <FontAwesomeIcon icon={faCheck} />
                                  )}
                                  Confirmar Troca
                                </button>
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botão de Exclusão Geral / Desvincular Tudo (para manter a compatibilidade/opção global) */}
              {mapeamentosDesteItem.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <p className="text-[11px] text-gray-500 mb-3 leading-relaxed font-semibold">
                    Caso queira desfazer completamente todos os vínculos e regras associadas a este material no modelo, clique no botão abaixo.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={onClose}
                      disabled={excluindo}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleExcluirTudo}
                      disabled={excluindo}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      {excluindo ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin />
                          Removendo tudo...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faTrash} />
                          Desvincular Todas as Regras 3D
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {abaAtiva === 'composicao' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-5">
                <h3 className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faDiagramProject} className="text-blue-500" />
                  Como funcionam as Composições?
                </h3>
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  Você pode atrelar a &quot;Quantidade&quot; de um item invisível no 3D (ex: Prego) para depender da quantidade deste item principal (Pai), através de um fator multiplicador.
                </p>
              </div>
              
              <div className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-200 pb-2">
                Insumos Atrelados a este Pai ({filhos.length})
              </div>

              {filhos.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <FontAwesomeIcon icon={faBoxOpen} className="text-2xl mb-2 text-gray-300" />
                  <p className="text-xs font-medium">Nenhum insumo atrelado ainda.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-6">
                  {filhos.map(f => {
                    const obj = f.material || f.sinapi || { nome: 'Insumo Misterioso' };
                    return (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg group hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <FontAwesomeIcon icon={faBoxOpen} className="text-[10px]" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-700 leading-tight">{obj.nome || obj.descricao}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              1 {materialOuSinapi.unidade} (Pai) = <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{f.fator_conversao || '1'} {f.unidade_override || obj.unidade_medida || 'UN'}</span> (Filho)
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleDesplugarFilho(f.id)} className="text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600 px-2 py-1 rounded"
                          title="Desatrelar este insumo"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CONTROLES PARA ATRELAR NEW FILHO */}
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  Atrelar Novo Insumo
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    value={novoFilhoSelecaoId}
                    onChange={e => setNovoFilhoSelecaoId(e.target.value)}
                    className="w-full text-xs p-2 border border-emerald-200 rounded outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="">-- Selecione o item avulso --</option>
                    {itensAvulsosOrfaos.map(m => {
                      const mObj = m.material || m.sinapi;
                      return (
                        <option key={m.id} value={m.id}>
                          {mObj?.nome || mObj?.descricao || 'Desconhecido'} (Quant. Base: {m.fator_conversao || 0})
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={handlePlugarFilho}
                    disabled={!novoFilhoSelecaoId || salvandoFilho}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors disabled:opacity-50"
                  >
                    {salvandoFilho ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                    Atrelar a este Item
                  </button>
                  <p className="text-[10px] text-emerald-600/80 leading-tight mt-1 text-center font-medium">
                    Apenas Itens Avulsos orfãos adicionados ao orçamento podem ser atrelados.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrash, faExclamationTriangle, faLink, faBoxOpen, faSave, faSpinner, faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function BimGerenciarVinculosModal({
  isOpen,
  onClose,
  materialOuSinapi, // O objeto da linha consolidade (precisamos do material_id ou sinapi_id e origem)
  mapeamentos, // Array com todos os mapeamentos puxados pelo hook
  onExcluir, // Função async deletarMapeamento
}) {
  const supabase = createClient();
  const [excluindo, setExcluindo] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('exclusao'); // 'exclusao' | 'composicao'
  const [salvandoFilho, setSalvandoFilho] = useState(false);
  const [novoFilhoSelecaoId, setNovoFilhoSelecaoId] = useState('');

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
      
      toast.success('Desvinculado com sucesso!');
      onClose();
    } catch (err) {
      toast.error('Falha ao remover alguns os vínculos.');
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
      // Force refresh do cache ou do onclose
      onClose(); // por enquanto fecha pra rebuildar
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100"
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
          <button 
            onClick={onClose}
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
        <div className="p-5 flex-1 overflow-y-auto max-h-[500px]">
          {abaAtiva === 'exclusao' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <p className="text-sm text-gray-600 mb-4 font-medium">
                Deseja desvincular este item do visualizador 3D?
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 mb-6 font-medium leading-relaxed">
                Isto removerá <strong>todas as {mapeamentosDesteItem.length} regras de ancoragem</strong> (famílias, tipos ou instâncias) associadas a ele. Todas as suas Composições Filhas voltarão a ser Insumos Avulsos sem valor quantitativo associado.
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={onClose}
                  disabled={excluindo}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExcluirTudo}
                  disabled={excluindo || mapeamentosDesteItem.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {excluindo ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faTrash} />
                      Desvincular Regras 3D
                    </>
                  )}
                </button>
              </div>
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
                  Você pode atrelar a "Quantidade" de um item invisível no 3D (ex: Prego) para depender da quantidade deste item principal (Pai), através de um fator multiplicador.
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
                            <p className="text-[11px] font-bold text-gray-700 leading-tight">{obj.nome}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              1 {materialOuSinapi.unidade_medida} (Pai) = <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{f.fator_conversao || '1'} {f.unidade_override || obj.unidade_medida || 'UN'}</span> (Filho)
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDesplugarFilho(f.id)} 
                          className="text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600 px-2 py-1 rounded"
                          title="Desatrelar este insumo"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CONTROLES PARA ATRELAR NOVO FILHO */}
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
                          {mObj?.nome || 'Desconhecido'} (Quant. Base: {m.fator_conversao || 0})
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

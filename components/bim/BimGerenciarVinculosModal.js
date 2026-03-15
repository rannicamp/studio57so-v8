import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrash, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimGerenciarVinculosModal({
  isOpen,
  onClose,
  materialOuSinapi, // O objeto da linha consolidade (precisamos do material_id ou sinapi_id e origem)
  mapeamentos, // Array com todos os mapeamentos puxados pelo hook
  onExcluir, // Função async deletarMapeamento
}) {
  const [excluindo, setExcluindo] = useState(false);

  if (!isOpen || !materialOuSinapi) return null;

  // Filtra mapeamentos acessando o objeto aninhado vindo do join (m.material.id ou m.sinapi.id)
  const mapeamentosDesteItem = mapeamentos.filter(m => {
    if (materialOuSinapi.origem === 'sinapi') {
      const mId = m.sinapi?.id || m.sinapi_id;
      return mId && String(mId) === String(materialOuSinapi.sinapi_id);
    }
    const mId = m.material?.id || m.material_id;
    return mId && String(mId) === String(materialOuSinapi.material_id);
  });

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 bg-red-50/30">
          <div className="flex gap-4">
            <div className="w-10 h-10 shrink-0 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-lg" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Desvincular Material</h2>
              <p className="text-xs font-semibold text-gray-500 mt-1 line-clamp-2">
                {materialOuSinapi.nome}
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-4">
            Tem certeza que deseja desvincular este item?
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 mb-6">
            Isso removerá <strong>todas as {mapeamentosDesteItem.length} regras de mapeamento</strong> associadas a ele e todas as quantidades voltarão a ficar isoladas no modelo 3D.
          </div>

          <div className="flex justify-end gap-3">
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 border border-transparent rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {excluindo ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Desvinculando...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faTrash} />
                  Desvincular
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

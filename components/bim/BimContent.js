// Caminho: components/bim/BimContent.js
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faCloudUploadAlt, faPlus, faSpinner, faClock } from '@fortawesome/free-solid-svg-icons';
import AutodeskViewerAPI from './AutodeskViewerAPI';
import BimUploadModal from './BimUploadModal';

export default function BimContent({ context, onFileSelect, activeFileUrn }) {
  const supabase = createClient();
  const { organizacao_id: organizacaoId } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Busca travada para não recarregar
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['bimFiles', context?.uniqueId, organizacaoId],
    queryFn: async () => {
      let query = supabase.from('projetos_bim').select('*');
      if (context?.type === 'folder') {
        query = query.eq('empreendimento_id', context.obraId).eq('disciplina_id', context.id);
      }
      const { data } = await query.eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });
      return data || [];
    },
    enabled: !!organizacaoId,
    staleTime: Infinity, 
    refetchOnWindowFocus: false 
  });

  return (
    <div className="h-full w-full relative bg-gray-100 overflow-hidden">
      
      {/* === CAMADA 0: O VISUALIZADOR (Fundo Persistente) === */}
      <div 
        className="absolute inset-0 z-0 bg-gray-900"
        style={{ 
            visibility: activeFileUrn ? 'visible' : 'hidden', // Só esconde visualmente, mantém na memória
            opacity: activeFileUrn ? 1 : 0 
        }}
      >
          {/* O componente só recebe o URN se ele existir, para evitar erros */}
          {activeFileUrn && <AutodeskViewerAPI urn={activeFileUrn} />}
      </div>

      {/* === CAMADA 1: A LISTA DE ARQUIVOS (Sobreposição) === */}
      {/* Se tiver activeUrn (viewer aberto), escondemos a lista com display:none para liberar cliques no 3D */}
      <div 
        className="absolute inset-0 z-10 flex flex-col bg-gray-50 transition-opacity duration-300"
        style={{ 
            display: activeFileUrn ? 'none' : 'flex' 
        }}
      >
          {/* Header da Lista */}
          <div className="p-6 border-b bg-white flex justify-between items-center shadow-sm">
            <div>
                <h2 className="text-xl font-black text-gray-800 tracking-tighter flex items-center gap-2">
                    {context?.nome || 'EXPLORADOR GERAL'}
                    {files.length > 0 && <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{files.length} PROJ.</span>}
                </h2>
                <p className="text-xs text-gray-400 font-medium">Gerencie modelos 3D Revit</p>
            </div>
            <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md flex items-center gap-2"
            >
                <FontAwesomeIcon icon={faPlus} /> UPLOAD
            </button>
          </div>

          {/* Grid de Arquivos */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-50">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500 mb-4" />
                    <p className="text-xs font-bold text-gray-500">CARREGANDO...</p>
                </div>
            ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                    <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 text-3xl mb-2" />
                    <p className="text-gray-400 text-xs">Pasta vazia.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {files.map(file => (
                        <div 
                            key={file.id}
                            onClick={() => onFileSelect(file.urn_autodesk)}
                            className="group bg-white border border-gray-200 p-3 rounded-xl hover:shadow-lg hover:border-blue-400 transition-all cursor-pointer relative"
                        >
                            <div className="h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                <FontAwesomeIcon icon={faCube} className="text-3xl text-gray-300 group-hover:text-blue-400" />
                            </div>
                            <h3 className="font-bold text-gray-700 text-xs truncate mb-1">{file.nome_arquivo}</h3>
                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                                <span><FontAwesomeIcon icon={faClock} /> {new Date(file.criado_em).toLocaleDateString()}</span>
                                <span className="bg-gray-100 px-1.5 rounded text-gray-500 font-bold">v{file.versao || 1}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
      </div>

      <BimUploadModal 
          isOpen={isUploadModalOpen} 
          onClose={() => setIsUploadModalOpen(false)} 
          preSelectedContext={context}
          onSuccess={() => refetch()} 
      />
    </div>
  );
}
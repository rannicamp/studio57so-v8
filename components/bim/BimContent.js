// Caminho: components/bim/BimContent.js
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faCloudUploadAlt, faPlus, faSpinner, faHistory, faFileSignature, faClock } from '@fortawesome/free-solid-svg-icons';
import AutodeskViewerAPI from './AutodeskViewerAPI';
import BimUploadModal from './BimUploadModal';

export default function BimContent({ context, onFileSelect, activeFileUrn }) {
  const supabase = createClient();
  const { organizacao_id: organizacaoId } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // 1. BUSCA DE ARQUIVOS (Filtro por Contexto ou Geral)
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
    enabled: !!organizacaoId
  });

  if (activeFileUrn) {
    return <AutodeskViewerAPI urn={activeFileUrn} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Header Interno Sophisticado */}
      <div className="p-6 border-b bg-white/80 backdrop-blur-md flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tighter flex items-center gap-2">
                {context?.nome || 'EXPLORADOR GERAL'}
                {files.length > 0 && <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{files.length} PROJETOS</span>}
            </h2>
            <p className="text-xs text-gray-400 font-medium">Gerencie modelos 3D Revit com integração direta Autodesk</p>
        </div>
        <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
        >
            <FontAwesomeIcon icon={faPlus} />
            NOVO UPLOAD
        </button>
      </div>

      {/* Grid de Arquivos com Visual Sofisticado */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-50">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500 mb-4" />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Sincronizando Galeria...</p>
            </div>
        ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 text-3xl" />
                </div>
                <h3 className="text-gray-600 font-bold text-lg">Esta pasta está pronta para seus projetos</h3>
                <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">Suba arquivos .RVT do Revit e visualize em 3D instantaneamente.</p>
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="text-blue-600 font-bold text-sm hover:underline"
                >
                    Começar primeiro upload
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {files.map(file => (
                    <div 
                        key={file.id}
                        onClick={() => onFileSelect(file.urn_autodesk)}
                        className="group bg-white border border-gray-100 p-4 rounded-3xl shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
                    >
                        {/* Preview Placeholder Estilizado */}
                        <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                             <FontAwesomeIcon icon={faCube} className="text-4xl text-gray-200 group-hover:text-blue-200 transition-colors" />
                             <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-lg text-[9px] font-black text-blue-600 shadow-sm border border-blue-50">
                                REVIT .RVT
                             </div>
                        </div>

                        <h3 className="font-bold text-gray-800 text-sm truncate mb-1 group-hover:text-blue-600 transition-colors" title={file.nome_arquivo}>
                            {file.nome_arquivo}
                        </h3>
                        
                        <div className="flex items-center gap-3 mt-3 text-[10px]">
                            <div className="flex items-center gap-1 text-gray-400">
                                <FontAwesomeIcon icon={faClock} />
                                {new Date(file.criado_em).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-black">
                                v{file.versao || 1}
                            </div>
                        </div>

                        {/* Overlay Hover Efeito Brilho */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>
        )}
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
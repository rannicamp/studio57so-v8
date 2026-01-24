// Caminho: components/bim/BimContent.js
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faCloudUploadAlt, faPlus, faSpinner, faClock, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import BimUploadModal from './BimUploadModal';

export default function BimContent({ context, onFileSelect }) {
  const supabase = createClient();
  const { organizacao_id: organizacaoId } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Busca APENAS a lista de arquivos
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
    <div className="h-full flex flex-col bg-gray-50">
      
      {/* Header da Pasta */}
      <div className="p-6 border-b bg-white flex justify-between items-center shadow-sm z-10">
        <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tighter flex items-center gap-2 uppercase">
                <FontAwesomeIcon icon={faFolderOpen} className="text-yellow-400" />
                {context?.nome || 'Projetos Recentes'}
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-1">
                {files.length > 0 ? `${files.length} arquivos encontrados` : 'Nenhum arquivo nesta pasta'}
            </p>
        </div>
        <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
        >
            <FontAwesomeIcon icon={faPlus} /> UPLOAD
        </button>
      </div>

      {/* Grid de Arquivos */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-4 text-blue-300" />
                <p className="text-xs font-bold uppercase tracking-widest">Carregando...</p>
            </div>
        ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-gray-300 text-4xl mb-4" />
                <h3 className="text-gray-600 font-bold text-sm uppercase">Pasta Vazia</h3>
                <button onClick={() => setIsUploadModalOpen(true)} className="text-blue-500 font-bold text-xs hover:underline mt-2">
                    Clique para adicionar arquivos
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {files.map(file => (
                    <div 
                        key={file.id}
                        onClick={() => onFileSelect(file.urn_autodesk)}
                        className="group bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                    >
                        <div className="aspect-video bg-gray-100 rounded-xl mb-3 flex items-center justify-center group-hover:bg-blue-50 transition-colors relative">
                             <FontAwesomeIcon icon={faCube} className="text-3xl text-gray-300 group-hover:text-blue-400 transition-colors" />
                        </div>

                        <h3 className="font-bold text-gray-700 text-xs truncate mb-1" title={file.nome_arquivo}>
                            {file.nome_arquivo}
                        </h3>
                        
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 border-t border-gray-50 pt-2">
                            <span className="flex items-center gap-1">
                                <FontAwesomeIcon icon={faClock} /> {new Date(file.criado_em).toLocaleDateString()}
                            </span>
                            <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                                v{file.versao || 1}
                            </span>
                        </div>
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
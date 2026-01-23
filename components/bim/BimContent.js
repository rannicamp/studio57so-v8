'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faInfoCircle, faCloudUploadAlt, faPlus } from '@fortawesome/free-solid-svg-icons';
import AutodeskViewerAPI from './AutodeskViewerAPI';
import BimUploadModal from './BimUploadModal'; // <--- Importamos o modal

export default function BimContent({ context, onFileSelect, activeFileUrn }) {
  const supabase = createClientComponentClient();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // <--- Estado do Modal

  // Função para buscar arquivos (reutilizável)
  const fetchFiles = async () => {
    if (!context || context.type !== 'folder') return;
    
    setLoading(true);
    const { data } = await supabase
        .from('projetos_bim')
        .select('*')
        .eq('empreendimento_id', context.obraId)
        .eq('disciplina_id', context.id)
        .order('versao', { ascending: false });
    
    setFiles(data || []);
    setLoading(false);
  };

  // Busca inicial quando muda a pasta
  useEffect(() => {
    fetchFiles();
  }, [context]);

  // Callback: O que fazer quando o upload termina com sucesso?
  const handleUploadSuccess = () => {
      fetchFiles(); // Recarrega a lista para mostrar o arquivo novo!
  };

  // --- CENÁRIO 1: Visualizador Ativo ---
  if (activeFileUrn) {
      return (
          <div className="flex-1 h-full bg-gray-900 relative flex flex-col">
              <div className="h-10 bg-black border-b border-gray-800 flex items-center justify-between px-4">
                  <span className="text-gray-300 text-xs font-mono">Modo Visualização 3D</span>
                  <button onClick={() => onFileSelect(null)} className="text-xs text-blue-400 hover:text-blue-300">
                      Fechar Viewer
                  </button>
              </div>
              <div className="flex-1 relative">
                  <AutodeskViewerAPI urn={activeFileUrn} />
              </div>
          </div>
      );
  }

  // --- CENÁRIO 2: Tela Vazia (Nenhuma pasta selecionada) ---
  if (!context) {
      return (
          <div className="flex-1 h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
              <FontAwesomeIcon icon={faCube} className="text-6xl mb-4 opacity-10" />
              <p>Selecione uma disciplina na barra lateral para ver os projetos.</p>
              {/* Botão de Upload Genérico (Sem contexto) */}
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-6 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 shadow-sm"
              >
                  <FontAwesomeIcon icon={faPlus} className="mr-2"/>
                  Novo Upload
              </button>

              <BimUploadModal 
                  isOpen={isUploadModalOpen} 
                  onClose={() => setIsUploadModalOpen(false)} 
                  preSelectedContext={null}
                  onSuccess={() => {}} // Não precisa recarregar lista aqui pois não tem lista
              />
          </div>
      );
  }

  // --- CENÁRIO 3: Lista de Arquivos da Pasta ---
  return (
    <div className="flex-1 h-full bg-white flex flex-col">
        {/* Header da Pasta */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="text-blue-600 bg-blue-100 p-2 rounded text-lg">{context.sigla}</span>
                    {context.nome}
                </h1>
                <p className="text-gray-500 text-sm mt-1">Arquivos encontrados: {files.length}</p>
            </div>
            
            {/* Botão de Upload Contextual */}
            <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md flex items-center gap-2 transition-transform active:scale-95"
            >
                <FontAwesomeIcon icon={faCloudUploadAlt} />
                Upload nesta pasta
            </button>
        </div>

        {/* Tabela de Arquivos */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            {loading ? <p className="text-gray-400 text-sm animate-pulse">Buscando arquivos...</p> : (
                files.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                        <p className="text-gray-400">Nenhum arquivo nesta pasta.</p>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="mt-2 text-blue-600 text-sm font-bold hover:underline"
                        >
                            Começar agora
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {files.map(file => (
                            <div 
                                key={file.id} 
                                className="group border border-gray-200 rounded-xl p-4 hover:shadow-xl hover:border-blue-400 transition-all bg-white cursor-pointer relative"
                                onClick={() => onFileSelect(file.urn_autodesk)}
                            >
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FontAwesomeIcon icon={faInfoCircle} className="text-gray-400 hover:text-blue-600"/>
                                </div>

                                <div className="flex items-center justify-center h-28 bg-gray-100 rounded-lg mb-3 group-hover:bg-blue-50 transition-colors overflow-hidden relative">
                                    {/* Thumbnail Placeholder */}
                                    <FontAwesomeIcon icon={faCube} className="text-4xl text-gray-300 group-hover:text-blue-500 z-10" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                                </div>
                                
                                <h3 className="font-bold text-gray-800 text-sm truncate mb-1" title={file.nome_arquivo}>
                                    {file.nome_arquivo}
                                </h3>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">v{file.versao}</span>
                                    <span className="text-gray-400">{new Date(file.criado_em).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>

        {/* O Modal de Upload Contextual */}
        <BimUploadModal 
            isOpen={isUploadModalOpen} 
            onClose={() => setIsUploadModalOpen(false)} 
            preSelectedContext={context} // Passamos onde estamos para ele auto-preencher
            onSuccess={handleUploadSuccess} // Recarrega a lista ao terminar
        />
    </div>
  );
}
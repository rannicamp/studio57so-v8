// Caminho: app/(main)/teste-bim/page.js
'use client';

import { useState, useEffect } from 'react';
import BimUploader from '@/components/bim/BimUploader'; 
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI'; 
import ProjectList from '@/components/bim/ProjectList'; // Importando a nova lista

export default function TesteBimPage() {
  const [currentUrn, setCurrentUrn] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'upload'

  // 1. EFEITO DE PERSISTÊNCIA (Ao carregar a página)
  useEffect(() => {
    // Verifica se existe um projeto salvo na memória do navegador
    const savedUrn = localStorage.getItem('studio57_last_bim_urn');
    if (savedUrn) {
        console.log("Restaurando sessão anterior:", savedUrn);
        setCurrentUrn(savedUrn);
    }
  }, []);

  // 2. Função Centralizada de Seleção
  const handleSelectModel = (urn) => {
    if (!urn) return;
    
    console.log("Projeto Selecionado:", urn);
    setCurrentUrn(urn);
    
    // Salva na memória para quando o usuário voltar
    localStorage.setItem('studio57_last_bim_urn', urn);
    
    // Se quiser focar na lista após upload, pode mudar aqui
    setViewMode('list'); 
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      
      {/* Cabeçalho */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between md:items-center border-b border-gray-200 pb-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-orange-600 w-2 h-6 rounded-sm block"></span>
                Gestão de Obras (BIM)
            </h1>
            <p className="mt-1 text-sm text-gray-500 pl-4">
            Gerenciamento e compatibilização de projetos.
            </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
            <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
                MEUS PROJETOS
            </button>
            <button 
                onClick={() => setViewMode('upload')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
                NOVO UPLOAD
            </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
            
            {/* Coluna Esquerda: Gerenciador (Scrollável) */}
            <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pb-10">
                
                {viewMode === 'upload' ? (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
                        <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Novo Arquivo</h3>
                        {/* Ao terminar upload, já seleciona o modelo automaticamente */}
                        <BimUploader onUploadComplete={handleSelectModel} />
                        <div className="mt-4 text-center">
                            <button onClick={() => setViewMode('list')} className="text-xs text-blue-600 hover:underline">
                                Cancelar e voltar para lista
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
                        <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase border-b pb-2">Projetos Recentes</h3>
                        {/* Lista de Projetos do Banco */}
                        <ProjectList 
                            onSelectProject={handleSelectModel} 
                            activeUrn={currentUrn}
                        />
                    </div>
                )}

                {/* Info Box */}
                {currentUrn && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800">
                        <p className="font-bold mb-1">Status da Sessão:</p>
                        <p>Projeto carregado e salvo na memória local.</p>
                    </div>
                )}
            </div>

            {/* Coluna Direita: O VISUALIZADOR */}
            <div className="lg:col-span-3 h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <AutodeskViewerAPI urn={currentUrn} />
            </div>

        </div>
    </div>
  );
}
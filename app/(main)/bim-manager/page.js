// Caminho: app/(main)/bim-manager/page.js
'use client';

import { useState } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimContent from '@/components/bim/BimContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFileDownload, faHistory } from '@fortawesome/free-solid-svg-icons';

export default function BimManagerPage() {
  const [selectedContext, setSelectedContext] = useState(null); // Pasta selecionada (Disciplina)
  const [activeUrn, setActiveUrn] = useState(null); // Arquivo aberto no Viewer
  const [sidebarRightOpen, setSidebarRightOpen] = useState(false); // Detalhes do arquivo

  // Função chamada quando clica na árvore
  const handleContextSelect = (context) => {
    setSelectedContext(context);
    setActiveUrn(null); // Fecha viewer se mudar de pasta
  };

  // Função chamada quando clica num arquivo
  const handleFileSelect = (urn) => {
      if (!urn) {
          setActiveUrn(null);
          setSidebarRightOpen(false);
          return;
      }
      setActiveUrn(urn);
      setSidebarRightOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
      
      {/* 1. SIDEBAR ESQUERDA (Navegação) */}
      <BimSidebar 
        onSelectContext={handleContextSelect} 
        selectedContext={selectedContext} 
      />

      {/* 2. ÁREA CENTRAL (Conteúdo/Viewer) */}
      <main className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-200">
        <BimContent 
            context={selectedContext} 
            activeFileUrn={activeUrn}
            onFileSelect={handleFileSelect}
        />
      </main>

      {/* 3. SIDEBAR DIREITA (Propriedades - Só aparece se tiver arquivo selecionado) */}
      {sidebarRightOpen && activeUrn && (
          <aside className="w-72 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10 transition-all">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-sm text-gray-700">Propriedades</h3>
                  <button onClick={() => setSidebarRightOpen(false)} className="text-gray-400 hover:text-red-500">
                      <FontAwesomeIcon icon={faTimes} />
                  </button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Bloco Info */}
                  <div className="text-center">
                      <div className="w-20 h-20 bg-blue-100 rounded-lg mx-auto flex items-center justify-center mb-3">
                          <span className="text-2xl font-bold text-blue-600">RVT</span>
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Projeto Arquitetônico</h4>
                      <p className="text-xs text-gray-500">Versão 3.0</p>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-2">
                      <button className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-600">
                          <FontAwesomeIcon icon={faFileDownload} className="mb-2 text-blue-600"/>
                          Baixar Original
                      </button>
                      <button className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-600">
                          <FontAwesomeIcon icon={faHistory} className="mb-2 text-orange-600"/>
                          Ver Histórico
                      </button>
                  </div>

                  {/* Metadados Dummy (Ligaremos ao banco depois) */}
                  <div className="space-y-3 text-xs border-t pt-4">
                      <div className="flex justify-between">
                          <span className="text-gray-500">Tamanho:</span>
                          <span className="font-medium">45.2 MB</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">Criado em:</span>
                          <span className="font-medium">23/01/2026</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">Autor:</span>
                          <span className="font-medium">Ranniere Mendes</span>
                      </div>
                  </div>
              </div>
          </aside>
      )}
    </div>
  );
}
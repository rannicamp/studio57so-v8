// Caminho: app/(main)/bim-manager/page.js
'use client';

import { useState, useEffect } from 'react';
import BimSidebar from '@/components/bim/BimSidebar';
import BimContent from '@/components/bim/BimContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFileDownload, faHistory, faInfoCircle, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

export default function BimManagerPage() {
  const [selectedContext, setSelectedContext] = useState(null); 
  const [activeUrn, setActiveUrn] = useState(null); 

  useEffect(() => {
    const savedUrn = localStorage.getItem('studio57_last_bim_urn');
    if (savedUrn) {
        setActiveUrn(savedUrn);
    }
  }, []);

  const handleContextSelect = (context) => {
    setSelectedContext(context);
    // Nota: Não limpamos o activeUrn aqui para permitir que o usuário
    // navegue pelas pastas sem fechar o visualizador se ele quiser.
    // Se preferir fechar, descomente a linha abaixo:
    // setActiveUrn(null); 
  };

  const handleFileSelect = (urn) => {
      if (!urn) return;
      setActiveUrn(urn);
      localStorage.setItem('studio57_last_bim_urn', urn);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50/30">
      
      {/* Sidebar de Navegação - AGORA COM onFileSelect */}
      <BimSidebar 
        onSelectContext={handleContextSelect} 
        onFileSelect={handleFileSelect} // <--- Conexão Mágica Aqui
        selectedContext={selectedContext} 
        activeUrn={activeUrn} // Para destacar o card ativo
      />

      <main className="flex-1 flex flex-col relative">
        {/* Breadcrumb / Botão Voltar (Só aparece se visualizador estiver ativo) */}
        {activeUrn && (
            <div className="absolute top-4 left-4 z-20 flex gap-2">
                {/* Você pode adicionar botões extras de controle aqui */}
            </div>
        )}

        <BimContent 
            context={selectedContext} 
            onFileSelect={handleFileSelect}
            activeFileUrn={activeUrn}
        />
      </main>

      {/* Sidebar Lateral de Detalhes (Direita) */}
      {activeUrn && (
          <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-2xl animate-slide-in-right z-30">
              <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-black text-gray-800 tracking-tighter uppercase text-sm">Propriedades</h3>
                  <button onClick={() => setActiveUrn(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <FontAwesomeIcon icon={faTimes} />
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Botões de Ação */}
                  <div className="grid grid-cols-2 gap-3">
                      <button className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-100 text-[10px] font-bold text-blue-700 transition-all group">
                          <FontAwesomeIcon icon={faFileDownload} className="mb-2 text-lg group-hover:scale-110 transition-transform"/>
                          DOWNLOAD
                      </button>
                      <button className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-2xl border border-orange-100 text-[10px] font-bold text-orange-700 transition-all group">
                          <FontAwesomeIcon icon={faHistory} className="mb-2 text-lg group-hover:scale-110 transition-transform"/>
                          VERSÕES
                      </button>
                  </div>

                  <div className="p-4 bg-gray-900 rounded-2xl text-white">
                      <div className="flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faInfoCircle} className="text-blue-400 text-xs" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Status</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                          Visualização ativa via Autodesk APS. Todos os metadados do Revit estão disponíveis no painel de propriedades do viewer.
                      </p>
                  </div>
              </div>
          </aside>
      )}
    </div>
  );
}
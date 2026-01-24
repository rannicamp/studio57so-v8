// Caminho: components/bim/BimContent.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faMousePointer, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

export default function BimContent({ children, activeFile }) {
  
  // Se houver um arquivo ativo (selecionado no Sidebar), 
  // o BimContent apenas renderiza o que está dentro dele (o Viewer)
  if (activeFile) {
      return (
          <div className="flex-1 h-full bg-white relative">
              {children}
          </div>
      );
  }

  // ESTADO VAZIO: Quando nenhum arquivo foi aberto ainda
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-gray-50 p-12 text-center">
      {/* Ícone central com efeito de profundidade */}
      <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8 border border-gray-100 animate-bounce-slow">
          <FontAwesomeIcon icon={faCube} className="text-4xl text-blue-500/20" />
      </div>
      
      <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">
            Studio 57 <span className="text-blue-600">BIM Manager</span>
          </h2>
          
          <p className="text-gray-500 text-sm leading-relaxed">
            Seu ambiente de gerenciamento de modelos está pronto. 
            Utilize o <span className="font-bold text-gray-700">Navegador lateral</span> para selecionar uma disciplina e abrir o projeto desejado.
          </p>

          {/* Dicas Visuais */}
          <div className="pt-8 flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  <FontAwesomeIcon icon={faLayerGroup} className="text-blue-500" /> 
                  1. Escolha a Disciplina
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  <FontAwesomeIcon icon={faMousePointer} className="text-blue-500" /> 
                  2. Abra o Modelo
              </div>
          </div>
      </div>

      {/* Marca d'água de fundo */}
      <div className="absolute bottom-10 opacity-[0.03] pointer-events-none select-none">
          <h1 className="text-9xl font-black italic">STUDIO 57</h1>
      </div>
    </div>
  );
}
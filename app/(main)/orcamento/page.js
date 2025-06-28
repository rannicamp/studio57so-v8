'use client';

import { useState } from 'react';
import OrcamentoManager from '@/components/OrcamentoManager';
import MaterialImporter from '@/components/materiais/MaterialImporter'; // Importe o novo componente

export default function OrcamentoPage() {
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Gestão de Orçamentos
        </h1>
        <button
          onClick={() => setIsImporterOpen(true)}
          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
        >
          Importar Materiais
        </button>
      </div>

      <p className="mb-8 text-gray-600">
        Crie, visualize e gerencie os orçamentos dos seus empreendimentos.
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <OrcamentoManager />
      </div>

      {/* O Modal de importação que será exibido quando o botão for clicado */}
      <MaterialImporter 
        isOpen={isImporterOpen} 
        onClose={() => setIsImporterOpen(false)} 
      />
    </div>
  );
}
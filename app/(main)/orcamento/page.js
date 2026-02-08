//app\(main)\orcamento\page.js
'use client';

import OrcamentoManager from '@/components/orcamento/OrcamentoManager';

export default function OrcamentoPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Gestão de Orçamentos
        </h1>
      </div>

      <p className="mb-8 text-gray-600">
        Crie, visualize e gerencie os orçamentos dos seus empreendimentos.
      </p>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <OrcamentoManager />
      </div>
    </div>
  );
}
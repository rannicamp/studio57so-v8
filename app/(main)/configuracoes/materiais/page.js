'use client';

import GerenciadorMateriais from '@/components/configuracoes/GerenciadorMateriais';

export default function MateriaisPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Gerenciamento de Materiais Próprios
        </h1>
        <p className="text-gray-600 mt-2">
          Organize o cadastro de materiais, edite nomes e unifique itens duplicados para manter o estoque organizado.
        </p>
      </div>

      <GerenciadorMateriais />
    </div>
  );
}
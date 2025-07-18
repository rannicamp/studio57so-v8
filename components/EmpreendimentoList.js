"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faEye } from '@fortawesome/free-solid-svg-icons';

export default function EmpreendimentoList({ initialEmpreendimentos }) {
  const [empreendimentos] = useState(initialEmpreendimentos);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmpreendimentos = empreendimentos.filter(empreendimento =>
    empreendimento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (empreendimento.empresa_proprietaria?.razao_social && empreendimento.empresa_proprietaria.razao_social.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusClass = (status) => {
    switch (status) {
      case 'Em Obras':
        return 'bg-blue-100 text-blue-800';
      case 'Em Lançamento':
        return 'bg-yellow-100 text-yellow-800';
      case 'Entregue':
        return 'bg-green-100 text-green-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Buscar por nome do empreendimento ou empresa..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-4 border border-gray-300 rounded-md"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome do Empreendimento</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa Proprietária</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEmpreendimentos.map((empreendimento) => (
              <tr key={empreendimento.id} className="hover:bg-gray-50">
                <td className="py-4 px-6 whitespace-nowrap font-medium text-gray-900">{empreendimento.nome}</td>
                <td className="py-4 px-6 whitespace-nowrap text-gray-500">{empreendimento.empresa_proprietaria?.razao_social || 'N/A'}</td>
                <td className="py-4 px-6 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(empreendimento.status)}`}>
                    {empreendimento.status}
                  </span>
                </td>
                <td className="py-4 px-6 whitespace-nowrap text-right text-sm font-medium">
                  {/* MODIFICAÇÃO AQUI: O link "Ver Produtos" agora aponta para a página de visualização principal */}
                  <Link href={`/empreendimentos/${empreendimento.id}`} className="text-green-600 hover:text-green-900 mr-4">
                    <FontAwesomeIcon icon={faEye} className="mr-1" /> Visualizar
                  </Link>
                  <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="text-indigo-600 hover:text-indigo-900">
                    <FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
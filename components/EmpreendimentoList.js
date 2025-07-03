"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faEdit } from '@fortawesome/free-solid-svg-icons';

export default function EmpreendimentoList({ initialEmpreendimentos }) {
  const router = useRouter();
  // Garante que a lista de empreendimentos seja sempre um array para evitar erros.
  const [empreendimentos] = useState(initialEmpreendimentos || []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmpreendimentos = useMemo(() => {
    if (!searchTerm) return empreendimentos;
    const lowercasedFilter = searchTerm.toLowerCase();
    
    // Filtro mais seguro para evitar erros
    return empreendimentos.filter(emp => {
      // Ignora qualquer item que seja inválido
      if (!emp) return false; 
      
      const nomeMatch = emp.nome && emp.nome.toLowerCase().includes(lowercasedFilter);
      
      // Verifica se a empresa e a razão social existem antes de tentar filtrar
      const empresaMatch = emp.empresa_proprietaria && emp.empresa_proprietaria.razao_social && emp.empresa_proprietaria.razao_social.toLowerCase().includes(lowercasedFilter);
      
      return nomeMatch || empresaMatch;
    });
  }, [empreendimentos, searchTerm]);

  return (
    <div className="space-y-4 p-4">
      <input
        type="text"
        placeholder="Buscar por nome do empreendimento ou empresa..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 border rounded-md w-full max-w-lg shadow-sm"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome do Empreendimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Empresa Proprietária</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmpreendimentos.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-semibold">{emp.nome}</td>
                {/* Usando o '?' para garantir que o código não quebre se a empresa for nula */}
                <td className="px-6 py-4 whitespace-nowrap">{emp.empresa_proprietaria?.razao_social || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.status === 'Em Andamento' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {emp.status || 'N/A'}
                    </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                  <button onClick={() => router.push(`/empreendimentos/${emp.id}/produtos`)} className="text-green-600 hover:text-green-800 font-semibold flex items-center gap-2 inline-flex">
                      <FontAwesomeIcon icon={faBox} /> Ver Produtos
                  </button>
                  <button onClick={() => alert('Função de edição a ser implementada.')} className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2 inline-flex">
                      <FontAwesomeIcon icon={faEdit} /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
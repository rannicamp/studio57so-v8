"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Usando o alias
import Link from 'next/link'; // Para links de edição/visualização
import { format } from 'date-fns'; // Para formatar datas
import { ptBR } from 'date-fns/locale'; // Para formatação em português

export default function RdoListManager({ initialRdos }) {
  const supabase = createClient();
  const [rdos, setRdos] = useState(initialRdos);
  const [message, setMessage] = useState('');
  const [filterText, setFilterText] = useState('');

  const filteredRdos = rdos.filter(rdo => 
    rdo.data_rdo.includes(filterText) ||
    rdo.empreendimento?.nome.toLowerCase().includes(filterText.toLowerCase()) ||
    rdo.empreendimento?.empresa?.nome_fantasia.toLowerCase().includes(filterText.toLowerCase()) ||
    rdo.funcionario?.full_name.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleDeleteRdo = async (rdoId) => {
    if (!confirm('Tem certeza que deseja excluir este Diário de Obra?')) {
      return;
    }
    setMessage('Excluindo RDO...');
    const { error } = await supabase
      .from('rdo')
      .delete()
      .eq('id', rdoId);

    if (error) {
      setMessage(`Erro ao excluir RDO: ${error.message}`);
      console.error('Erro ao excluir RDO:', error);
    } else {
      setMessage('Diário de Obra excluído com sucesso!');
      setRdos(prevRdos => prevRdos.filter(rdo => rdo.id !== rdoId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filtrar por data, empreendimento, empresa ou funcionário..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="p-2 border border-gray-300 rounded-md w-full max-w-md shadow-sm"
        />
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data RDO</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empreendimento</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRdos.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  Nenhum Diário de Obra encontrado.
                </td>
              </tr>
            ) : (
              filteredRdos.map((rdo) => (
                <tr key={rdo.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {format(new Date(rdo.data_rdo), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {rdo.empreendimento?.nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {rdo.empreendimento?.empresa?.nome_fantasia || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {rdo.funcionario?.full_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* Você pode adicionar links para visualizar/editar o RDO aqui */}
                    {/* Exemplo: <Link href={`/rdo/editar/${rdo.id}`} className="text-blue-600 hover:text-blue-900 mr-4">Editar</Link> */}
                    <button 
                      onClick={() => handleDeleteRdo(rdo.id)} 
                      className="text-red-600 hover:text-red-900"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
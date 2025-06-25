"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function EmpresaList({ initialEmpresas, isAdmin }) {
  const supabase = createClient();
  const router = useRouter();
  const [empresas, setEmpresas] = useState(initialEmpresas);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmpresas = useMemo(() => {
    if (!searchTerm) return empresas;
    return empresas.filter(emp => 
      emp.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.nome_fantasia && emp.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.cnpj && emp.cnpj.includes(searchTerm))
    );
  }, [empresas, searchTerm]);

  const handleDelete = async (empresaId) => {
    if (!confirm('Tem certeza que deseja excluir esta empresa? A exclusão não poderá ser desfeita.')) return;

    const { error } = await supabase.from('cadastro_empresa').delete().eq('id', empresaId);

    if (error) {
      alert(`Erro ao excluir empresa: ${error.message}`);
    } else {
      setEmpresas(prev => prev.filter(emp => emp.id !== empresaId));
      alert('Empresa excluída com sucesso.');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <input
        type="text"
        placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 border rounded-md w-full max-w-lg shadow-sm"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Razão Social</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome Fantasia</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">CNPJ</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Telefone</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmpresas.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{emp.razao_social}</td>
                <td className="px-6 py-4 whitespace-nowrap">{emp.nome_fantasia}</td>
                <td className="px-6 py-4 whitespace-nowrap">{emp.cnpj}</td>
                <td className="px-6 py-4 whitespace-nowrap">{emp.telefone}</td>
                <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                  <button onClick={() => router.push(`/empresas/editar/${emp.id}`)} className="text-blue-600 hover:text-blue-800 font-semibold">Editar</button>
                  {isAdmin && (
                    <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 font-semibold">Excluir</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
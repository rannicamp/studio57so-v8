"use client";

import { useEffect, useState } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faIdCard, faBuilding, faPhone, faEnvelope, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function DuplicatasPage() {
  const { setPageTitle } = useLayout();
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('Contatos Duplicados');
    
    // A ALTERAÇÃO ESTÁ AQUI: Adicionamos { cache: 'no-store' } para garantir que os dados sejam sempre novos.
    fetch('/api/contatos/duplicates', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        setDuplicateGroups(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao buscar duplicatas:", err);
        setLoading(false);
      });
  }, [setPageTitle]);

  if (loading) {
    return (
        <div className="text-center p-10">
            <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
            <p className="mt-4 text-lg">Buscando contatos duplicados...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      {duplicateGroups.length === 0 ? (
        <div className="text-center p-10 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold text-green-600">Nenhum contato duplicado encontrado!</h2>
          <p className="mt-2 text-gray-600">Sua base de contatos está limpa.</p>
        </div>
      ) : (
        duplicateGroups.map((group, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">
                    <FontAwesomeIcon icon={group.type === 'CPF' || group.type === 'CNPJ' ? faIdCard : faUsers} className="mr-3 text-red-500" />
                    Duplicata por {group.type}: <span className="font-mono bg-gray-100 p-1 rounded">{group.value}</span>
                </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.contatos.map(contato => (
                <div key={contato.id} className="border p-4 rounded-lg bg-gray-50 space-y-3">
                  <h3 className="font-bold text-lg">{contato.nome}</h3>
                  <p><FontAwesomeIcon icon={faBuilding} className="mr-2 w-4 text-gray-500" /> {contato.tipo_contato}</p>
                  {contato.cpf && <p><span className="font-semibold">CPF:</span> {contato.cpf}</p>}
                  {contato.cnpj && <p><span className="font-semibold">CNPJ:</span> {contato.cnpj}</p>}
                  {contato.telefones && (
                    <div className="flex items-start">
                        <FontAwesomeIcon icon={faPhone} className="mr-2 w-4 mt-1 text-gray-500" />
                        <div>{contato.telefones.join(', ')}</div>
                    </div>
                  )}
                  {contato.emails && (
                    <div className="flex items-start">
                        <FontAwesomeIcon icon={faEnvelope} className="mr-2 w-4 mt-1 text-gray-500" />
                        <div className="truncate">{contato.emails.join(', ')}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 text-right">
                <button className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700">
                    Juntar Contatos
                </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
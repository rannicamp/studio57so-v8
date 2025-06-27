"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faColumns } from '@fortawesome/free-solid-svg-icons';

// Define todas as colunas possíveis e seus nomes de exibição
const allColumns = [
  { key: 'nome', label: 'Nome' },
  { key: 'tipo_contato', label: 'Tipo' },
  { key: 'empresa', label: 'Empresa/Fantasia' },
  { key: 'documento', label: 'CNPJ/CPF' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'cargo', label: 'Cargo/Profissão' },
  { key: 'status', label: 'Status' },
];

export default function ContatoList({ initialContatos }) {
  const router = useRouter();
  const [contatos, setContatos] = useState(initialContatos);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  // NOVO: Estado para controlar a visibilidade das colunas
  const [visibleColumns, setVisibleColumns] = useState({
    nome: true,
    tipo_contato: true,
    empresa: true,
    documento: true,
    email: true,
    telefone: false,
    cargo: false,
    status: false,
  });

  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef(null);

  // Fecha o seletor de colunas se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setIsColumnSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnSelectorRef]);


  const handleToggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredContatos = useMemo(() => {
    return contatos.filter(c => {
      const typeMatch = !filterType || c.tipo_contato === filterType;
      const searchMatch = !searchTerm || 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.razao_social && c.razao_social.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.cnpj && c.cnpj.includes(searchTerm));
        
      return typeMatch && searchMatch;
    });
  }, [contatos, searchTerm, filterType]);

  const handleRowClick = (id) => {
    router.push(`/contatos/editar/${id}`);
  };

  const getColumnValue = (contato, key) => {
    switch (key) {
      case 'empresa':
        return contato.nome_fantasia || contato.razao_social || 'N/A';
      case 'documento':
        return contato.cnpj || contato.cpf || 'N/A';
      case 'email':
        return contato.emails?.[0]?.email || 'N/A';
      case 'telefone':
        return contato.telefones?.[0]?.telefone || 'N/A';
      default:
        return contato[key] || 'N/A';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar por nome, razão social, CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 border rounded-md w-full md:flex-grow shadow-sm"
        />
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="p-2 border rounded-md w-full md:w-auto shadow-sm"
        >
          <option value="">Todos os Tipos</option>
          <option value="Contato">Contato</option>
          <option value="Cliente">Cliente</option>
          <option value="Fornecedor">Fornecedor</option>
          <option value="Lead">Lead</option>
        </select>
        
        {/* NOVO: Botão e menu para selecionar colunas */}
        <div className="relative" ref={columnSelectorRef}>
          <button 
            onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
            className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon icon={faColumns} />
            <span>Exibir Colunas</span>
          </button>
          {isColumnSelectorOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border">
              <div className="p-2 font-semibold text-sm">Selecione as colunas</div>
              {allColumns.map(col => (
                <label key={col.key} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => handleToggleColumn(col.key)}
                    className="mr-2 h-4 w-4 rounded"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {allColumns.map(col => (
                visibleColumns[col.key] && (
                  <th key={col.key} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {col.label}
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredContatos.map((contato) => (
              <tr key={contato.id} onClick={() => handleRowClick(contato.id)} className="hover:bg-gray-50 cursor-pointer">
                {allColumns.map(col => (
                  visibleColumns[col.key] && (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm">
                      {getColumnValue(contato, col.key)}
                    </td>
                  )
                ))}
              </tr>
            ))}
             {filteredContatos.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="text-center py-10 text-gray-500">
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
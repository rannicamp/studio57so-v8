"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faColumns, faTrashAlt, faEdit } from '@fortawesome/free-solid-svg-icons';

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

export default function ContatoList({ initialContatos, onActionComplete }) {
  const supabase = createClient();
  const router = useRouter();
  const [contatos, setContatos] = useState(initialContatos);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedContatos, setSelectedContatos] = useState([]);
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

  useEffect(() => {
    setContatos(initialContatos);
  }, [initialContatos]);

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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedContatos(filteredContatos.map(c => c.id));
    } else {
      setSelectedContatos([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedContatos(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedContatos.length === 0) {
        alert('Nenhum contato selecionado.');
        return;
    }
    if (window.confirm(`Tem certeza que deseja excluir ${selectedContatos.length} contato(s)? Esta ação não pode ser desfeita.`)) {
        const { error } = await supabase
            .from('contatos')
            .delete()
            .in('id', selectedContatos);

        if (error) {
            alert('Erro ao excluir contatos: ' + error.message);
        } else {
            setSelectedContatos([]);
            alert('Contatos excluídos com sucesso!');
            router.refresh(); // Força a atualização dos dados da página
            if (onActionComplete) {
                onActionComplete();
            }
        }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
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
        </div>
        
        <div className="flex items-center gap-4">
            {selectedContatos.length > 0 && (
                 <button 
                    onClick={handleDeleteSelected}
                    className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faTrashAlt} />
                    <span>Excluir ({selectedContatos.length})</span>
                </button>
            )}
            <div className="relative" ref={columnSelectorRef}>
                <button 
                    onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                    className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faColumns} />
                    <span>Colunas</span>
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
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    onChange={handleSelectAll}
                    checked={filteredContatos.length > 0 && selectedContatos.length === filteredContatos.length}
                />
              </th>
              {allColumns.map(col => (
                visibleColumns[col.key] && (
                  <th key={col.key} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {col.label}
                  </th>
                )
              ))}
               <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredContatos.map((contato) => (
              <tr key={contato.id} className={`${selectedContatos.includes(contato.id) ? 'bg-blue-50' : ''} hover:bg-gray-50`}>
                <td className="px-4 py-4">
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={selectedContatos.includes(contato.id)}
                        onChange={() => handleSelectOne(contato.id)}
                    />
                </td>
                {allColumns.map(col => (
                  visibleColumns[col.key] && (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer" onClick={() => handleRowClick(contato.id)}>
                      {getColumnValue(contato, col.key)}
                    </td>
                  )
                ))}
                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => handleRowClick(contato.id)} className="text-blue-600 hover:text-blue-800" title="Editar Contato">
                        <FontAwesomeIcon icon={faEdit} />
                    </button>
                 </td>
              </tr>
            ))}
             {filteredContatos.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} className="text-center py-10 text-gray-500">
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
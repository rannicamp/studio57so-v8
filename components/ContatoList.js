"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faColumns, faTrashAlt, faEdit } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../utils/formatters';

// Componente para o Círculo de Progresso
const ProgressCircle = ({ score }) => {
    const percentage = Math.min(Math.max(score, 0), 100);
    const circumference = 2 * Math.PI * 18; // 2 * pi * raio
    const offset = circumference - (percentage / 100) * circumference;

    let colorClass = 'text-red-500';
    if (percentage >= 80) {
        colorClass = 'text-green-500';
    } else if (percentage >= 40) {
        colorClass = 'text-yellow-500';
    }

    return (
        <div className="relative flex items-center justify-center w-12 h-12">
            <svg className="w-full h-full" viewBox="0 0 40 40">
                <circle
                    className="text-gray-200"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    r="18"
                    cx="20"
                    cy="20"
                />
                <circle
                    className={`${colorClass} transition-all duration-500`}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="18"
                    cx="20"
                    cy="20"
                    transform="rotate(-90 20 20)"
                />
            </svg>
            <span className={`absolute text-xs font-bold ${colorClass}`}>
                {Math.round(percentage)}%
            </span>
        </div>
    );
};

// Função para calcular a pontuação de preenchimento
const calculateScore = (contato) => {
    if (!contato.nome) return 0;
    let score = 0;
    if (contato.telefones && contato.telefones.length > 0) score += 35;
    if (contato.emails && contato.emails.length > 0) score += 25;
    if (contato.cpf || contato.cnpj) score += 20;
    if (contato.cep) score += 15;
    if (contato.estado_civil) score += 5;
    return score;
};

const allColumns = [
  { key: 'qualidade', label: 'Qualidade' }, // Nova coluna
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
    qualidade: true, // Visível por padrão
    nome: true,
    tipo_contato: true,
    empresa: true,
    documento: false,
    email: true,
    telefone: true,
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
        (c.cnpj && c.cnpj.includes(searchTerm)) ||
        (c.telefones.some(t => t.telefone.includes(searchTerm)));

      return typeMatch && searchMatch;
    });
  }, [contatos, searchTerm, filterType]);

  const handleRowClick = (id) => {
    router.push(`/contatos/editar/${id}`);
  };

  const getColumnValue = (contato, key) => {
    switch (key) {
      case 'qualidade':
        return <ProgressCircle score={calculateScore(contato)} />;
      case 'empresa':
        return contato.nome_fantasia || contato.razao_social || 'N/A';
      case 'documento':
        return contato.cnpj || contato.cpf || 'N/A';
      case 'email':
        return contato.emails?.[0]?.email || 'N/A';
      case 'telefone':
        return formatPhoneNumber(contato.telefones?.[0]?.telefone) || 'N/A';
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
            placeholder="Buscar por nome, empresa, telefone..."
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
// components/ContatoList.js

"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faColumns, faTrashAlt, faEdit, faSort, faSortUp, faSortDown, faUsers } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../utils/formatters';
import MergeModal from './contatos/MergeModal';
import { toast } from 'sonner';

const ProgressCircle = ({ score }) => {
    const percentage = Math.min(Math.max(score, 0), 100);
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (percentage / 100) * circumference;
    let colorClass = 'text-red-500';
    if (percentage >= 80) colorClass = 'text-green-500';
    else if (percentage >= 40) colorClass = 'text-yellow-500';
    return (
        <div className="relative flex items-center justify-center w-12 h-12">
            <svg className="w-full h-full" viewBox="0 0 40 40">
                <circle className="text-gray-200" strokeWidth="4" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" />
                <circle className={`${colorClass} transition-all duration-500`} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" transform="rotate(-90 20 20)" />
            </svg>
            <span className={`absolute text-xs font-bold ${colorClass}`}>{Math.round(percentage)}%</span>
        </div>
    );
};

const calculateScore = (contato) => {
    if (!contato.nome && !contato.razao_social) return 0;
    let score = 0;
    if (contato.telefones && contato.telefones.length > 0) score += 35;
    if (contato.emails && contato.emails.length > 0) score += 25;
    if (contato.cpf || contato.cnpj) score += 20;
    if (contato.cep) score += 15;
    if (contato.estado_civil) score += 5;
    return score;
};

const allColumns = [
  { key: 'qualidade', label: 'Qualidade', sortable: false },
  { key: 'display_name', label: 'Nome / Razão Social', sortable: true },
  { key: 'tipo_contato', label: 'Tipo', sortable: true },
  { key: 'documento', label: 'CNPJ/CPF', sortable: true },
  { key: 'email', label: 'E-mail', sortable: true },
  { key: 'telefone', label: 'Telefone', sortable: true },
  { key: 'cargo', label: 'Cargo/Profissão', sortable: true },
];

// ALTERADO: Adicionamos `onRowClick` na lista de propriedades
export default function ContatoList({ initialContatos, onActionComplete, onRowClick }) {
  const supabase = createClient();
  const router = useRouter();
  const [contatos, setContatos] = useState(initialContatos);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedContatos, setSelectedContatos] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({ qualidade: true, display_name: true, tipo_contato: true, documento: false, email: true, telefone: true, cargo: false });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({ key: 'display_name', direction: 'ascending' });
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => { setContatos(initialContatos); }, [initialContatos]);
  useEffect(() => {
    function handleClickOutside(event) { if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) setIsColumnSelectorOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnSelectorRef]);

  const handleToggleColumn = (key) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const sortedAndFilteredContatos = useMemo(() => {
    let filtered = [...contatos].map(c => ({
      ...c,
      display_name: c.personalidade_juridica === 'Pessoa Jurídica' ? c.razao_social : c.nome,
      documento: c.cnpj || c.cpf,
      email: c.emails?.[0]?.email,
      telefone: c.telefones?.[0]?.telefone,
    }));

    if (filterType) {
      filtered = filtered.filter(c => c.tipo_contato === filterType);
    }

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(lowercasedFilter)) ||
        (c.razao_social && c.razao_social.toLowerCase().includes(lowercasedFilter)) ||
        (c.cnpj && c.cnpj.includes(lowercasedFilter)) ||
        (c.telefones.some(t => t.telefone.includes(searchTerm)))
      );
    }
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [contatos, searchTerm, filterType, sortConfig]);

  // ALTERADO: A função de editar agora é separada da de visualizar
  const handleEditClick = (id) => {
    router.push(`/contatos/editar/${id}`);
  };

  const getColumnValue = (contato, key) => {
    switch (key) {
      case 'qualidade': return <ProgressCircle score={calculateScore(contato)} />;
      case 'telefone': return formatPhoneNumber(contato.telefone);
      default: return contato[key] || 'N/A';
    }
  };

  const handleSelectAll = (e) => setSelectedContatos(e.target.checked ? sortedAndFilteredContatos.map(c => c.id) : []);
  const handleSelectOne = (id) => setSelectedContatos(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  
  const handleDeleteSelected = async () => {
    if (selectedContatos.length === 0 || !window.confirm(`Excluir ${selectedContatos.length} contato(s)? Esta ação cuidará das associações existentes, mas não pode ser desfeita.`)) return;

    const deletePromises = selectedContatos.map(id =>
        supabase.rpc('delete_contato_completo', { p_contato_id: id })
    );

    toast.promise(Promise.all(deletePromises), {
        loading: `Excluindo ${selectedContatos.length} contato(s)...`,
        success: () => {
            setSelectedContatos([]);
            if (onActionComplete) onActionComplete();
            return `${selectedContatos.length} contato(s) excluído(s) com sucesso!`;
        },
        error: (err) => {
            if (onActionComplete) onActionComplete();
            return `Erro ao excluir um ou mais contatos: ${err.message}`;
        }
    });
  };

  const SortableHeader = ({ col }) => {
    const getSortIcon = () => {
        if (!col.sortable || sortConfig.key !== col.key) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };
    return (
        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
            <button disabled={!col.sortable} onClick={() => col.sortable && requestSort(col.key)} className="flex items-center gap-2 hover:text-gray-900 disabled:cursor-default">
                <span>{col.label}</span>
                {col.sortable && <FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" />}
            </button>
        </th>
    );
  };
  
  const contactsToMerge = useMemo(() => {
    return contatos.filter(c => selectedContatos.includes(c.id));
  }, [selectedContatos, contatos]);

  const handleMergeComplete = () => {
    setSelectedContatos([]);
    onActionComplete();
  };

  return (
    <div className="space-y-4">
      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        contactsToMerge={contactsToMerge}
        onMergeComplete={handleMergeComplete}
      />

      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-col md:flex-row gap-4">
          <input type="text" placeholder="Buscar por nome, razão social, telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md w-full md:flex-grow shadow-sm" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="p-2 border rounded-md w-full md:w-auto shadow-sm"> <option value="">Todos os Tipos</option> <option>Contato</option> <option>Cliente</option> <option>Fornecedor</option> <option>Lead</option> </select>
        </div>
        <div className="flex items-center gap-4">
            {selectedContatos.length > 0 && (
                <>
                    {selectedContatos.length >= 2 && (
                        <button onClick={() => setIsMergeModalOpen(true)} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-orange-500 text-white hover:bg-orange-600 flex items-center justify-center gap-2">
                            <FontAwesomeIcon icon={faUsers} />
                            <span>Unir ({selectedContatos.length})</span>
                        </button>
                    )}
                    <button onClick={handleDeleteSelected} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faTrashAlt} />
                        <span>Excluir ({selectedContatos.length})</span>
                    </button>
                </>
            )}
            <div className="relative" ref={columnSelectorRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-2"> <FontAwesomeIcon icon={faColumns} /> <span>Colunas</span> </button>
                {isColumnSelectorOpen && ( <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border"> <div className="p-2 font-semibold text-sm">Selecione as colunas</div> {allColumns.map(col => ( <label key={col.key} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer text-sm"> <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => handleToggleColumn(col.key)} className="mr-2 h-4 w-4 rounded" /> {col.label} </label> ))} </div> )}
            </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left"> <input type="checkbox" className="h-4 w-4 rounded" onChange={handleSelectAll} checked={sortedAndFilteredContatos.length > 0 && selectedContatos.length === sortedAndFilteredContatos.length}/> </th>
              {allColumns.map(col => (visibleColumns[col.key] && <SortableHeader key={col.key} col={col} />))}
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAndFilteredContatos.map((contato) => (
              // ALTERADO: A linha agora chama `onRowClick` e tem um cursor
              <tr key={contato.id} onClick={() => onRowClick(contato)} className={`cursor-pointer ${selectedContatos.includes(contato.id) ? 'bg-blue-50' : ''} hover:bg-gray-50`}>
                {/* ALTERADO: Adicionamos stopPropagation para os checkboxes e botões */}
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}> <input type="checkbox" className="h-4 w-4 rounded" checked={selectedContatos.includes(contato.id)} onChange={() => handleSelectOne(contato.id)}/> </td>
                {allColumns.map(col => (visibleColumns[col.key] && ( <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm"> {getColumnValue(contato, col.key)} </td> )))}
                <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}> <button onClick={() => handleEditClick(contato.id)} className="text-blue-600 hover:text-blue-800" title="Editar Contato"> <FontAwesomeIcon icon={faEdit} /> </button> </td>
              </tr>
            ))}
             {sortedAndFilteredContatos.length === 0 && ( <tr> <td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} className="text-center py-10 text-gray-500"> Nenhum contato encontrado. </td> </tr> )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
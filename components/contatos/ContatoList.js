// components/contatos/ContatoList.js
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faColumns, faTrashAlt, faEdit, faSort, faSortUp, faSortDown, faUsers, faSpinner, faPhone, faBuilding, faUserTag } from '@fortawesome/free-solid-svg-icons';
import { formatPhoneNumber } from '../../utils/formatters';
import MergeModal from './MergeModal';
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

// Configuração das colunas com classes de responsividade
const allColumns = [
  { key: 'qualidade', label: 'Qualidade', sortable: false, className: 'hidden md:table-cell' }, // Esconde no celular
  { key: 'display_name', label: 'Nome / Contato', sortable: true, className: '' }, // Sempre visível
  { key: 'tipo_contato', label: 'Tipo', sortable: true, className: 'hidden md:table-cell' }, // Esconde no celular (vai pra dentro do nome)
  { key: 'documento', label: 'CNPJ/CPF', sortable: true, className: 'hidden lg:table-cell' }, // Só mostra em telas grandes
  { key: 'email', label: 'E-mail', sortable: true, className: 'hidden lg:table-cell' }, // Só mostra em telas grandes
  { key: 'telefone', label: 'Telefone', sortable: true, className: 'hidden md:table-cell' }, // Esconde no celular (vai pra dentro do nome)
  { key: 'cargo', label: 'Cargo/Profissão', sortable: true, className: 'hidden xl:table-cell' }, // Só em telas muito grandes
];

export default function ContatoList({ 
    initialContatos, 
    onActionComplete, 
    onRowClick,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
}) {
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
  
  const observerTarget = useRef(null);

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

  // Infinite Scroll com Pre-fetching
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '600px', threshold: 0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget, hasNextPage, isFetchingNextPage, fetchNextPage]);


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
      filtered = filtered.filter(c => {
          const textMatch = (c.display_name && c.display_name.toLowerCase().includes(lowercasedFilter)) ||
                            (c.documento && c.documento.includes(lowercasedFilter));
          const emailMatch = c.emails?.some(e => e.email && e.email.toLowerCase().includes(lowercasedFilter));
          const phoneMatch = c.telefones?.some(t => t.telefone && t.telefone.includes(searchTerm));
          return textMatch || emailMatch || phoneMatch;
      });
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

  const handleEditClick = (id) => {
    router.push(`/contatos/editar/${id}`);
  };

  const getColumnValue = (contato, key) => {
    switch (key) {
      case 'qualidade': return <ProgressCircle score={calculateScore(contato)} />;
      case 'telefone': return formatPhoneNumber(contato.telefone); 
      case 'email': return contato.email || 'N/A';
      case 'display_name': 
        // LÓGICA HÍBRIDA: PC vs Celular
        return (
            <div className="flex flex-col">
                {/* Nome Principal (Visível em todos) */}
                <span className="font-medium text-gray-900">{contato.display_name || 'Sem Nome'}</span>
                
                {/* Detalhes APENAS para Celular (hidden md:block) */}
                <div className="md:hidden flex flex-col mt-1 gap-1">
                    {/* Telefone no Celular */}
                    {contato.telefone && (
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                            <FontAwesomeIcon icon={faPhone} className="w-3 h-3 text-gray-400" />
                            {formatPhoneNumber(contato.telefone)}
                        </span>
                    )}
                    {/* Tipo no Celular */}
                    {contato.tipo_contato && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                            {contato.tipo_contato}
                        </span>
                    )}
                </div>
            </div>
        );
      default: return contato[key] || 'N/A';
    }
  };

  const handleSelectAll = (e) => {
      setSelectedContatos(e.target.checked ? sortedAndFilteredContatos.map(c => c.id) : []);
  };
  
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
        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider sticky top-0 bg-gray-50 z-10 ${col.className}`}>
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
    <div className="flex flex-col h-full space-y-4">
      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        contactsToMerge={contactsToMerge}
        onMergeComplete={handleMergeComplete}
      />

      <div className="flex flex-col md:flex-row gap-4 justify-between flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <input type="text" placeholder="Buscar por nome, e-mail, telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md w-full md:flex-grow shadow-sm" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="p-2 border rounded-md w-full md:w-auto shadow-sm"> <option value="">Todos os Tipos</option> <option>Contato</option> <option>Cliente</option> <option>Fornecedor</option> <option>Lead</option> </select>
        </div>
        <div className="flex items-center gap-4">
            {selectedContatos.length > 0 && (
                <>
                    {selectedContatos.length >= 2 && (
                        <button onClick={() => setIsMergeModalOpen(true)} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-orange-500 text-white hover:bg-orange-600 flex items-center justify-center gap-2">
                            <FontAwesomeIcon icon={faUsers} />
                            <span className="hidden md:inline">Unir</span>
                            <span className="md:hidden">({selectedContatos.length})</span>
                        </button>
                    )}
                    <button onClick={handleDeleteSelected} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faTrashAlt} />
                        <span className="hidden md:inline">Excluir</span>
                        <span className="md:hidden">({selectedContatos.length})</span>
                    </button>
                </>
            )}
            <div className="relative" ref={columnSelectorRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="p-2 border rounded-md w-full md:w-auto shadow-sm bg-gray-100 hover:bg-gray-200 flex items-center justify-center gap-2"> <FontAwesomeIcon icon={faColumns} /> <span className="hidden md:inline">Colunas</span> </button>
                {isColumnSelectorOpen && ( <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border"> <div className="p-2 font-semibold text-sm">Selecione as colunas</div> {allColumns.map(col => ( <label key={col.key} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer text-sm"> <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => handleToggleColumn(col.key)} className="mr-2 h-4 w-4 rounded" /> {col.label} </label> ))} </div> )}
            </div>
        </div>
      </div>

      {/* Tabela com Scroll */}
      <div className="flex-grow overflow-auto border rounded-md relative">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left sticky top-0 bg-gray-50 z-10 shadow-sm w-10"> 
                <input type="checkbox" className="h-4 w-4 rounded" onChange={handleSelectAll} checked={sortedAndFilteredContatos.length > 0 && selectedContatos.length === sortedAndFilteredContatos.length} title="Selecionar todos visíveis"/> 
              </th>
              {allColumns.map(col => (
                  visibleColumns[col.key] && (
                    <SortableHeader key={col.key} col={col} />
                  )
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider sticky top-0 bg-gray-50 z-10 shadow-sm w-20">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAndFilteredContatos.map((contato) => (
              <tr key={contato.id} onClick={() => onRowClick(contato)} className={`cursor-pointer ${selectedContatos.includes(contato.id) ? 'bg-blue-50' : ''} hover:bg-gray-50`}>
                <td className="px-4 py-4 align-middle" onClick={(e) => e.stopPropagation()}> <input type="checkbox" className="h-4 w-4 rounded" checked={selectedContatos.includes(contato.id)} onChange={() => handleSelectOne(contato.id)}/> </td>
                {allColumns.map(col => (
                    visibleColumns[col.key] && ( 
                        <td key={col.key} className={`px-6 py-4 text-sm ${col.className}`}> 
                            {getColumnValue(contato, col.key)} 
                        </td> 
                    )
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-sm align-middle" onClick={(e) => e.stopPropagation()}> <button onClick={() => handleEditClick(contato.id)} className="text-blue-600 hover:text-blue-800 p-2" title="Editar Contato"> <FontAwesomeIcon icon={faEdit} /> </button> </td>
              </tr>
            ))}
             
             {/* Indicador de carregamento e Sentinela */}
             <tr ref={observerTarget}>
                <td colSpan="100%" className="p-4 text-center">
                    {isFetchingNextPage ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500 py-4">
                            <FontAwesomeIcon icon={faSpinner} spin /> Carregando mais contatos...
                        </div>
                    ) : hasNextPage ? (
                        <span className="text-gray-400 text-sm py-4 block">Role para carregar mais</span>
                    ) : sortedAndFilteredContatos.length > 0 ? (
                        <span className="text-green-600 text-sm py-4 block">Todos os contatos carregados.</span>
                    ) : (
                        <span className="text-gray-500 py-4 block">Nenhum contato encontrado.</span>
                    )}
                </td>
             </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
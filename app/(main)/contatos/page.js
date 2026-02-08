// Caminho: app/(main)/contatos/page.js
'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLayout } from '@/contexts/LayoutContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus, faSpinner, faTimes, faSearch,
  faPen, faTrash, faCopy, faUserCircle, faBuilding,
  faFileImport, faFileExport, faLayerGroup, 
  faObjectGroup, faWandMagicSparkles, faFilter,
  faSort, faSortUp, faSortDown, faAddressBook
} from '@fortawesome/free-solid-svg-icons'
import { useDebounce } from 'use-debounce'
import Image from 'next/image'

// Componentes
import ContatoForm from '@/components/contatos/ContatoForm'
import ContatoImporter from '@/components/contatos/ContatoImporter'
import MergeModal from '@/components/contatos/MergeModal'
import DuplicateContactsManager from '@/components/contatos/DuplicateContactsManager'
import PadronizacaoManager from '@/components/contatos/PadronizacaoManager'
import ContatoDetalhesSidebar from '@/components/contatos/ContatoDetalhesSidebar'
import { saveContactAction } from '@/components/contatos/actions';

// CHAVE ÚNICA PARA O LOCALSTORAGE
const CONTATOS_UI_STATE_KEY = 'STUDIO57_CONTATOS_UI_STATE_V1';

// Helper para ler o cache inicial
const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(CONTATOS_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

// --- BUSCA ADMIN TURBINADA ---
async function fetchContatosMain(organizacaoId, searchTerm, typeFilter) {
  if (!organizacaoId) return [];
  const supabase = createClient()
  
  let query = supabase.from('contatos').select(`*, telefones(telefone), emails(email)`)
    .eq('organizacao_id', organizacaoId)
  
  if (searchTerm && searchTerm.trim().length > 0) {
      const { data: idsEncontrados, error: rpcError } = await supabase.rpc('filtrar_ids_contatos', {
          p_organizacao_id: organizacaoId,
          p_search_term: searchTerm,
          p_type_filter: typeFilter === 'Todos' ? null : typeFilter
      });

      if (rpcError) {
          console.error("Erro na Super Busca:", rpcError);
          query = query.or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%`);
          if (typeFilter && typeFilter !== 'Todos') {
             query = query.eq('tipo_contato', typeFilter);
          }
      } else {
          if (!idsEncontrados || idsEncontrados.length === 0) return [];
          const listaIds = idsEncontrados.map(item => item.id);
          query = query.in('id', listaIds);
      }
  } else {
      if (typeFilter && typeFilter !== 'Todos') {
           query = query.eq('tipo_contato', typeFilter);
      }
  }
  
  query = query.order('nome', { ascending: true }).order('razao_social', { ascending: true });
  
  const { data, error } = await query
  
  if (error) { 
      console.error("Erro busca contatos:", error.message); 
      throw new Error(error.message) 
  }
  
  return (data || []).map(contato => ({
    ...contato, 
    telefone: contato.telefones?.[0]?.telefone || null, 
    email: contato.emails?.[0]?.email || null,
    nome_display: contato.nome || contato.razao_social || 'Nome Indefinido', 
    etapa_funil: 'N/A', 
    nome_funil: 'N/A',
  }));
}

export default function ContatosMain() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isUserLoading, setPageTitle } = useLayout()
  const organizacaoId = user?.organizacao_id
  const userId = user?.id
  
  const supabase = createClient()

  useEffect(() => {
      if(setPageTitle) setPageTitle('Gestão de Contatos');
  }, [setPageTitle]);

  // --- ESTADOS DOS MODAIS ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false)
  const [isStandardizeModalOpen, setIsStandardizeModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  // --- NOVO ESTADO PARA A SIDEBAR DE DETALHES ---
  const [sidebarContactId, setSidebarContactId] = useState(null)

  // --- ESTADOS COM PERSISTÊNCIA ---
  const cachedState = getCachedUiState();
  
  const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '')
  const [typeFilter, setTypeFilter] = useState(cachedState?.typeFilter || 'Todos') 
  const [sortConfig, setSortConfig] = useState(cachedState?.sortConfig || { key: 'nome_display', direction: 'ascending' })
  const [selectedContactIds, setSelectedContactIds] = useState(cachedState?.selectedContactIds || [])

  const [contatoParaEditar, setContatoParaEditar] = useState(null)
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500)

  // --- NOVO: ESTADO PARA OPÇÕES DO FILTRO ---
  const [filterOptions, setFilterOptions] = useState(['Lead', 'Cliente', 'Fornecedor', 'Parceiro', 'Corretor', 'Candidato']);

  // --- NOVO: BUSCAR OPÇÕES DO FILTRO NO BANCO ---
  useEffect(() => {
      const fetchFilterOptions = async () => {
          try {
              const { data, error } = await supabase.rpc('get_tipo_contato_options');
              if (!error && data && data.length > 0) {
                  setFilterOptions(data);
              }
          } catch (err) {
              console.error("Erro ao carregar filtros:", err);
          }
      };
      fetchFilterOptions();
  }, [supabase]);

  const hasRestoredUiState = useRef(true); 
  const isInitialMount = useRef(true);

  useEffect(() => {
      if (typeof window !== 'undefined' && hasRestoredUiState.current) {
          const stateToSave = {
              searchTerm,
              typeFilter,
              sortConfig,
              selectedContactIds
          };
          localStorage.setItem(CONTATOS_UI_STATE_KEY, JSON.stringify(stateToSave));
      }
  }, [searchTerm, typeFilter, sortConfig, selectedContactIds]);


  // --- QUERY PRINCIPAL ---
  const { data: contatos, isLoading, isFetching, isError, error, } = useQuery({
    queryKey: ['contatosMainLista', organizacaoId, debouncedSearchTerm, typeFilter],
    queryFn: () => fetchContatosMain(organizacaoId, debouncedSearchTerm, typeFilter),
    enabled: !!organizacaoId,
  })

  // --- LÓGICA DE SELEÇÃO ---
  const handleSelectAll = (e) => {
      if (e.target.checked && contatos) {
          setSelectedContactIds(contatos.map(c => c.id));
      } else {
          setSelectedContactIds([]);
      }
  };

  const handleSelectOne = (id) => {
      setSelectedContactIds(prev => {
          if (prev.includes(id)) {
              return prev.filter(item => item !== id);
          } else {
              return [...prev, id];
          }
      });
  };

  // --- ACTIONS EXTRAS ---
  const handleExport = async () => {
      if (!organizacaoId) return;
      setIsExporting(true);
      try {
          const response = await fetch('/api/contatos/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organizacaoId }),
          });
          
          if (!response.ok) throw new Error('Falha na exportação');
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contatos-export-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast.success("Exportação concluída!");
      } catch (error) {
          console.error(error);
          toast.error("Erro ao exportar contatos.");
      } finally {
          setIsExporting(false);
      }
  };

  const contactsToMerge = useMemo(() => {
      if (!contatos || selectedContactIds.length < 2) return [];
      return contatos.filter(c => selectedContactIds.includes(c.id));
  }, [contatos, selectedContactIds]);

  const handleMergeClick = () => {
      if (selectedContactIds.length < 2) {
          toast.warning("Selecione pelo menos 2 contatos para unir.");
          return;
      }
      setIsMergeModalOpen(true);
  };

  const handleMergeComplete = () => {
      setIsMergeModalOpen(false);
      setSelectedContactIds([]);
      queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
      toast.success("Contatos unidos com sucesso!");
  };

  // --- MUTATIONS ---
  const deleteMutation = useMutation({
      mutationFn: async (contatoId) => {
          const { error } = await supabase.from('contatos').delete().eq('id', contatoId);
          if (error) throw new Error(error.message);
      },
      onSuccess: () => {
          toast.success('Contato excluído com sucesso!');
          queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
      },
      onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const duplicateMutation = useMutation({
      mutationFn: async (contatoOriginal) => {
          const { id, created_at, updated_at, foto_url, ...dadosParaDuplicar } = contatoOriginal;
          const novoNome = `${dadosParaDuplicar.nome_display || 'Contato'} (Cópia)`;

          const formDataDuplicado = {
              ...dadosParaDuplicar,
              nome: contatoOriginal.personalidade_juridica === 'Pessoa Física' ? novoNome : dadosParaDuplicar.nome,
              razao_social: contatoOriginal.personalidade_juridica === 'Pessoa Jurídica' ? novoNome : dadosParaDuplicar.razao_social,
              nome_display: novoNome,
              telefones: contatoOriginal.telefones || [{ telefone: '', country_code: '+55' }],
              emails: contatoOriginal.emails || [{ email: '' }],
              conjuge_id: null,
              criado_por_usuario_id: userId,
              organizacao_id: organizacaoId,
          };

          const result = await saveContactAction({ formData: formDataDuplicado, isEditing: false });
          if (result.error) throw new Error(result.error);
          return result.contactId;
      },
      onSuccess: (novoContatoId) => {
          toast.success('Contato duplicado! Abrindo para edição...');
          queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
          const novoContato = contatos?.find(c => c.id === novoContatoId);
          if(novoContato) handleOpenModal(novoContato);
          else {
              supabase.from('contatos').select(`*, telefones(telefone), emails(email)`).eq('id', novoContatoId).single()
              .then(({data}) => {
                  if(data) handleOpenModal({
                       ...data,
                       telefone: data.telefones?.[0]?.telefone || null,
                       email: data.emails?.[0]?.email || null,
                       nome_display: data.nome || data.razao_social || 'Nome Indefinido',
                   });
              });
          }
      },
      onError: (err) => toast.error(`Erro ao duplicar: ${err.message}`),
  });

  useEffect(() => {
    if (!isInitialMount.current) { 
        if (!isFetching && !isError && prevIsFetchingRef.current && !isLoading) { } 
    } else { isInitialMount.current = false } 
    prevIsFetchingRef.current = isFetching;
  }, [isFetching, isError, isLoading])
  const prevIsFetchingRef = useRef(isLoading);

  const sortedContatos = useMemo(() => {
    let sortableItems = [...(contatos || [])]; 
    if (sortConfig.key !== null) { 
        sortableItems.sort((a, b) => { 
            const valA = a[sortConfig.key]; 
            const valB = b[sortConfig.key]; 
            if (valA === null || valA === undefined) return sortConfig.direction === 'ascending' ? 1 : -1; 
            if (valB === null || valB === undefined) return sortConfig.direction === 'ascending' ? -1 : 1; 
            const compareResult = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase()); 
            return sortConfig.direction === 'ascending' ? compareResult : -compareResult; 
        }); 
    } 
    return sortableItems;
   }, [contatos, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending'; 
    if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } 
    setSortConfig({ key, direction });
  };

  const handleOpenModal = (contato = null) => { setContatoParaEditar(contato); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setContatoParaEditar(null); };
  const handleSaveSuccess = useCallback(() => {
    setIsModalOpen(false); setContatoParaEditar(null); 
    queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] });
  }, [queryClient]);

  const handleDelete = (cliente) => {
      toast.error(`Tem certeza que deseja excluir "${cliente.nome_display}"?`, {
          action: { label: 'Excluir', onClick: () => deleteMutation.mutate(cliente.id) },
          cancel: { label: 'Cancelar' },
          duration: 8000,
      });
  };

  const SortableHeader = ({ label, sortKey, className = '' }) => {
     const getSortIcon = () => { if (sortConfig.key !== sortKey) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; }; 
     return ( <th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full"><span>{label}</span><FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" /></button></th> );
  };

  const isPageLoading = isLoading || isUserLoading;

  return (
    <div className="w-full p-4 space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Contatos</h2>
            {selectedContactIds.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-2">
                    {selectedContactIds.length} selecionado(s)
                    <button onClick={() => setSelectedContactIds([])} className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </span>
            )}
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
                {/* AQUI ESTÁ O FILTRO DINÂMICO AGORA */}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer font-medium hover:bg-gray-50 transition-colors"
                >
                    <option value="Todos">Todos os Tipos</option>
                    {filterOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <FontAwesomeIcon icon={faFilter} className="w-3 h-3" />
                </div>
            </div>

            {selectedContactIds.length >= 2 && (
                <button onClick={handleMergeClick} className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 animate-fadeIn">
                    <FontAwesomeIcon icon={faObjectGroup} className="mr-2" /> Unir
                </button>
            )}

            <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200" title="Importar">
                <FontAwesomeIcon icon={faFileImport} className="text-gray-500" />
            </button>
            <button onClick={handleExport} disabled={isExporting} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200" title="Exportar">
                {isExporting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileExport} className="text-gray-500" />}
            </button>
            
            <button onClick={() => setIsStandardizeModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200" title="Padronizar">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-purple-500" />
            </button>

            <button onClick={() => setIsDuplicatesModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200" title="Duplicatas">
                <FontAwesomeIcon icon={faLayerGroup} className="text-orange-500" />
            </button>
            <button onClick={() => handleOpenModal(null)} disabled={isPageLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200 disabled:bg-gray-400">
                <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo
            </button>
        </div>
      </div>

      <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FontAwesomeIcon icon={faSearch} className="text-gray-400" /></div>
          <input type="text" placeholder="Buscar por nome, telefone, documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
          {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-red-500" title="Limpar busca"><FontAwesomeIcon icon={faTimes} /></button> )}
      </div>

      {isPageLoading ? (
        <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} className="text-blue-500 text-4xl" spin /><p className="mt-2 text-gray-600">Carregando contatos...</p></div>
      ) : isError ? (
         <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"><strong className="font-bold">Erro!</strong><span className="block sm:inline"> {error.message}</span></div>
      ) : sortedContatos && sortedContatos.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-100">
               <tr>
                 <th className="py-3 px-4 w-10 text-center">
                    <input type="checkbox" onChange={handleSelectAll} checked={sortedContatos.length > 0 && selectedContactIds.length === sortedContatos.length} className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                 </th>
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left w-16">Foto</th>
                 <SortableHeader label="Nome" sortKey="nome_display" className="text-left" />
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left">Telefone</th>
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left">Email</th>
                 <SortableHeader label="Tipo" sortKey="tipo_contato" className="text-left" />
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">Ações</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
              {sortedContatos.map((cliente) => (
                <tr key={cliente.id} className={`hover:bg-gray-50 group ${selectedContactIds.includes(cliente.id) ? 'bg-blue-50' : ''}`}>
                   <td className="py-2 px-4 text-center">
                        <input type="checkbox" checked={selectedContactIds.includes(cliente.id)} onChange={() => handleSelectOne(cliente.id)} className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                   </td>
                   <td className="py-2 px-4">
                     {cliente.foto_url ? (<Image src={cliente.foto_url} alt={`Foto ${cliente.nome_display}`} width={40} height={40} className="rounded-full object-cover w-10 h-10" unoptimized />
                     ) : (<FontAwesomeIcon icon={cliente.personalidade_juridica === 'Pessoa Jurídica' ? faBuilding : faUserCircle} className={`w-10 h-10 rounded-full p-2 flex-shrink-0 ${ cliente.personalidade_juridica === 'Pessoa Jurídica' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600' }`} /> )}
                   </td>
                  <td className="py-3 px-4 font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSidebarContactId(cliente.id)}>{cliente.nome_display}</td>
                  
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.telefone || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.email || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{cliente.tipo_contato || 'Contato'}</td>
                  <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => handleOpenModal(cliente)} className="text-blue-600 hover:text-blue-800 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" title="Editar"><FontAwesomeIcon icon={faPen} /></button>
                        <button onClick={() => duplicateMutation.mutate(cliente)} disabled={duplicateMutation.isPending} className="text-green-600 hover:text-green-800 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity disabled:text-gray-400" title="Duplicar">
                            {duplicateMutation.isPending && duplicateMutation.variables?.id === cliente.id ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCopy} />}
                        </button>
                        <button onClick={() => handleDelete(cliente)} disabled={deleteMutation.isPending && deleteMutation.variables === cliente.id} className="text-red-500 hover:text-red-700 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity disabled:text-gray-400" title="Excluir">
                             {deleteMutation.isPending && deleteMutation.variables === cliente.id ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faTrash} />}
                        </button>
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg"><FontAwesomeIcon icon={searchTerm ? faSearch : faAddressBook} className="text-5xl text-gray-300 mb-4" /><h3 className="text-lg font-semibold text-gray-700">{searchTerm ? 'Nenhum resultado' : 'Nenhum contato'}</h3><p className="text-gray-500 text-sm mt-1">{searchTerm ? 'Ajuste sua busca.' : 'Cadastre um novo contato.'}</p></div>
      )}

      {/* MODAIS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-2xl font-bold text-gray-800">{contatoParaEditar ? 'Editar Contato' : 'Cadastrar Novo Contato'}</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-2 rounded-full"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
            </div>
            <div className="flex-grow overflow-y-auto">
              <ContatoForm contactToEdit={contatoParaEditar} onClose={handleCloseModal} onSaveSuccess={handleSaveSuccess} organizacaoId={organizacaoId} criadoPorUsuarioId={userId} />
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
             <div className="flex justify-between items-center p-6 border-b">
               <h3 className="text-xl font-bold text-gray-800">Importar Contatos</h3>
               <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
             </div>
             <div className="flex-grow overflow-y-auto p-6">
                <ContatoImporter onImportSuccess={() => { setIsImportModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] }); toast.success("Importação realizada!"); }} />
             </div>
          </div>
        </div>
      )}

      {isDuplicatesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
             <div className="flex justify-between items-center p-6 border-b">
               <h3 className="text-xl font-bold text-gray-800">Gerenciar Duplicatas</h3>
               <button onClick={() => { setIsDuplicatesModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] }); }} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
             </div>
             <div className="flex-grow overflow-y-auto p-6">
                <DuplicateContactsManager />
             </div>
          </div>
        </div>
      )}

      {isStandardizeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
             <div className="flex justify-between items-center p-6 border-b">
               <h3 className="text-xl font-bold text-gray-800">Padronizar Contatos</h3>
               <button onClick={() => { setIsStandardizeModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contatosMainLista'] }); }} className="text-gray-400 hover:text-gray-600"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
             </div>
             <div className="flex-grow overflow-y-auto p-6">
                <PadronizacaoManager />
             </div>
          </div>
        </div>
      )}

      <MergeModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} contactsToMerge={contactsToMerge} onMergeComplete={handleMergeComplete} />
      
      {/* --- SIDEBAR DE DETALHES (RENDERIZADA NO FINAL) --- */}
      <ContatoDetalhesSidebar 
        contactId={sidebarContactId} 
        onClose={() => setSidebarContactId(null)} 
      />
    </div>
  )
}
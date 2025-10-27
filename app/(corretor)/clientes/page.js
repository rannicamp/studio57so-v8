// app/(corretor)/clientes/page.js
'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLayout } from '@/contexts/LayoutContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus, faSpinner, faTimes, faUser, faBuilding,
  faAddressBook, faSort, faSortUp, faSortDown, faSearch,
  faPen, faUserCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useDebounce } from 'use-debounce'
import Image from 'next/image'
import ContatoForm from '@/components/contatos/ContatoForm' // Usa o formulário diretamente

// Função de busca (sem mudanças desta vez)
async function fetchClientesCorretor(organizacaoId, userId, searchTerm) {
  if (!organizacaoId || !userId) return [];
  const supabase = createClient()
  let query = supabase.from('contatos').select(`*, telefones(telefone), emails(email)`)
    .eq('organizacao_id', organizacaoId)
    .eq('criado_por_usuario_id', userId)
  if (searchTerm) { query = query.or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%`); }
  query = query.order('nome', { ascending: true }).order('razao_social', { ascending: true });
  const { data, error } = await query
  if (error) { console.error("Erro busca clientes:", error.message); throw new Error(error.message) }
  return (data || []).map(contato => ({
    ...contato,
    telefone: contato.telefones?.[0]?.telefone || null,
    email: contato.emails?.[0]?.email || null,
    nome_display: contato.nome || contato.razao_social || 'Nome Indefinido',
    etapa_funil: 'N/A', // Simplificado por agora
    nome_funil: 'N/A',  // Simplificado por agora
  }));
}

export default function ClientesCorretor() {
  const queryClient = useQueryClient()
  const { user, isUserLoading } = useLayout()
  const organizacaoId = user?.organizacao_id
  const userId = user?.id // ID do usuário para filtro

  const [isModalOpen, setIsModalOpen] = useState(false)
  const isInitialMount = useRef(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500)
  const [sortConfig, setSortConfig] = useState({ key: 'nome_display', direction: 'ascending' })
  const [contatoParaEditar, setContatoParaEditar] = useState(null)

  const { data: clientes, isLoading, isFetching, isError, error, } = useQuery({
    queryKey: ['clientesCorretor', organizacaoId, userId, debouncedSearchTerm],
    queryFn: () => fetchClientesCorretor(organizacaoId, userId, debouncedSearchTerm),
    enabled: !!organizacaoId && !!userId,
  })

  // Notificação (sem mudanças)
  useEffect(() => { /* ... */
    if (!isInitialMount.current) { if (!isFetching && !isError) { if(prevIsFetchingRef.current && !isLoading) { toast.info('Lista atualizada.') } } } else { isInitialMount.current = false } prevIsFetchingRef.current = isFetching;
  }, [isFetching, isError, isLoading])
  const prevIsFetchingRef = useRef(isLoading);

  // Ordenação (sem mudanças)
  const sortedClientes = useMemo(() => { /* ... */
    let sortableItems = [...(clientes || [])];
    if (sortConfig.key !== null) { sortableItems.sort((a, b) => { const valA = a[sortConfig.key]; const valB = b[sortConfig.key]; if (valA === null || valA === undefined) return sortConfig.direction === 'ascending' ? 1 : -1; if (valB === null || valB === undefined) return sortConfig.direction === 'ascending' ? -1 : 1; const compareResult = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase()); return sortConfig.direction === 'ascending' ? compareResult : -compareResult; }); } return sortableItems;
   }, [clientes, sortConfig]);

  // Request Sort (sem mudanças)
  const requestSort = (key) => { /* ... */
    let direction = 'ascending'; if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key, direction });
  };

  // Modal Control (sem mudanças)
  const handleOpenModal = (contato = null) => { setContatoParaEditar(contato); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setContatoParaEditar(null); };

  // Save Success Callback (sem mudanças)
  const handleSaveSuccess = useCallback(() => { /* ... */
    setIsModalOpen(false); setContatoParaEditar(null); toast.success(contatoParaEditar ? 'Cliente atualizado!' : 'Contato salvo!'); queryClient.invalidateQueries({ queryKey: ['clientesCorretor', organizacaoId, userId, debouncedSearchTerm] });
  }, [queryClient, organizacaoId, userId, debouncedSearchTerm, contatoParaEditar]);

  // Sortable Header (sem mudanças)
  const SortableHeader = ({ label, sortKey, className = '' }) => { /* ... */
    const getSortIcon = () => { if (sortConfig.key !== sortKey) return faSort; return sortConfig.direction === 'ascending' ? faSortUp : faSortDown; }; return ( <th className={`py-3 px-4 text-sm font-semibold text-gray-600 ${className}`}><button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 w-full"><span>{label}</span><FontAwesomeIcon icon={getSortIcon()} className="text-gray-400" /></button></th> );
  };

  const isPageLoading = isLoading || isUserLoading;

  // Renderização
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Meus Clientes e Leads</h2>
        <button onClick={() => handleOpenModal(null)} disabled={isPageLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200 disabled:bg-gray-400">
          <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo Contato
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FontAwesomeIcon icon={faSearch} className="text-gray-400" /></div>
          <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
          {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-red-500" title="Limpar busca"><FontAwesomeIcon icon={faTimes} /></button> )}
      </div>

      {/* Loading / Error / Tabela / Nenhum Contato */}
      {isPageLoading ? ( /* ... Loading ... */
        <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} className="text-blue-500 text-4xl" spin /><p className="mt-2 text-gray-600">Carregando...</p></div>
      ) : isError ? ( /* ... Error ... */
         <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"><strong className="font-bold">Erro!</strong><span className="block sm:inline"> {error.message}</span></div>
      ) : sortedClientes && sortedClientes.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-100">
               <tr>
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left w-16">Foto</th>
                 <SortableHeader label="Nome" sortKey="nome_display" className="text-left" />
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left">Telefone</th>
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-left">Email</th>
                 <SortableHeader label="Tipo" sortKey="tipo_contato" className="text-left" />
                 <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">Ações</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
              {sortedClientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50">
                   <td className="py-2 px-4">
                     {cliente.foto_url ? (<Image src={cliente.foto_url} alt={`Foto ${cliente.nome_display}`} width={40} height={40} className="rounded-full object-cover w-10 h-10" unoptimized />
                     ) : (<FontAwesomeIcon icon={cliente.personalidade_juridica === 'Pessoa Jurídica' ? faBuilding : faUserCircle} className={`w-10 h-10 rounded-full p-2 flex-shrink-0 ${ cliente.personalidade_juridica === 'Pessoa Jurídica' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600' }`} /> )}
                   </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{cliente.nome_display}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.telefone || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.email || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{cliente.tipo_contato || 'Contato'}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleOpenModal(cliente)} className="text-blue-600 hover:text-blue-800 p-1" title="Editar Cliente">
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : ( /* ... Nenhum contato ... */
        <div className="text-center py-10 bg-gray-50 rounded-lg"><FontAwesomeIcon icon={searchTerm ? faSearch : faAddressBook} className="text-5xl text-gray-300 mb-4" /><h3 className="text-lg font-semibold text-gray-700">{searchTerm ? 'Nenhum resultado' : 'Nenhum contato'}</h3><p className="text-gray-500 text-sm mt-1">{searchTerm ? 'Ajuste sua busca.' : 'Cadastre um novo contato.'}</p></div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-2xl font-bold text-gray-800">{contatoParaEditar ? 'Editar Contato' : 'Cadastrar Novo Contato'}</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-2 rounded-full"><FontAwesomeIcon icon={faTimes} size="lg" /></button>
            </div>
            <div className="flex-grow overflow-y-auto">
              <ContatoForm
                // --- CORREÇÃO AQUI ---
                // Passa a prop com o nome que o ContatoForm espera: 'contactToEdit'
                contactToEdit={contatoParaEditar}
                // --- FIM DA CORREÇÃO ---
                onClose={handleCloseModal}
                onSaveSuccess={handleSaveSuccess}
                organizacaoId={organizacaoId}
                criadoPorUsuarioId={userId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// app/(corretor)/clientes/page.js
'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  useQuery,
  // --- MUDANÇA: Importa useMutation ---
  useMutation,
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
  // --- MUDANÇA: Ícones para Excluir e Duplicar ---
  faTrash, faCopy,
} from '@fortawesome/free-solid-svg-icons'
import { useDebounce } from 'use-debounce'
import Image from 'next/image'
import ContatoForm from '@/components/contatos/ContatoForm'
// --- MUDANÇA: Importa a server action para salvar (usada na duplicação) ---
import { saveContactAction } from '@/components/contatos/actions';

// Função de busca (sem mudanças)
async function fetchClientesCorretor(organizacaoId, userId, searchTerm) { /* ... (código igual) ... */
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
    ...contato, telefone: contato.telefones?.[0]?.telefone || null, email: contato.emails?.[0]?.email || null,
    nome_display: contato.nome || contato.razao_social || 'Nome Indefinido', etapa_funil: 'N/A', nome_funil: 'N/A',
  }));
}

export default function ClientesCorretor() {
  const queryClient = useQueryClient()
  const { user, isUserLoading } = useLayout()
  const organizacaoId = user?.organizacao_id
  const userId = user?.id
  const supabase = createClient() // Instancia o Supabase client

  const [isModalOpen, setIsModalOpen] = useState(false)
  const isInitialMount = useRef(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500)
  const [sortConfig, setSortConfig] = useState({ key: 'nome_display', direction: 'ascending' })
  const [contatoParaEditar, setContatoParaEditar] = useState(null)

  // Query para buscar clientes (sem mudanças)
  const { data: clientes, isLoading, isFetching, isError, error, } = useQuery({
    queryKey: ['clientesCorretor', organizacaoId, userId, debouncedSearchTerm],
    queryFn: () => fetchClientesCorretor(organizacaoId, userId, debouncedSearchTerm),
    enabled: !!organizacaoId && !!userId,
  })

  // --- MUDANÇA: Mutation para Excluir Contato ---
  const deleteMutation = useMutation({
      mutationFn: async (contatoId) => {
          // *** IMPORTANTE: Verifica RLS (Regras de Segurança) ***
          // Garanta que suas RLS no Supabase só permitem que o usuário
          // delete contatos que ele criou ou que pertençam à sua organização.
          const { error } = await supabase
              .from('contatos')
              .delete()
              .eq('id', contatoId);
          if (error) throw new Error(error.message);
      },
      onSuccess: () => {
          toast.success('Cliente excluído com sucesso!');
          // Invalida a query para atualizar a lista
          queryClient.invalidateQueries({ queryKey: ['clientesCorretor', organizacaoId, userId, debouncedSearchTerm] });
      },
      onError: (err) => {
          toast.error(`Erro ao excluir cliente: ${err.message}`);
          console.error("Erro Supabase Delete:", err);
      },
  });

  // --- MUDANÇA: Mutation para Duplicar Contato ---
  const duplicateMutation = useMutation({
      mutationFn: async (contatoOriginal) => {
          // 1. Cria um novo objeto SEM o ID e ajusta o nome
          const { id, created_at, updated_at, foto_url, ...dadosParaDuplicar } = contatoOriginal;
          const novoNome = `${dadosParaDuplicar.nome_display || 'Contato'} (Cópia)`;

          // Prepara o formData para a saveContactAction
          const formDataDuplicado = {
              ...dadosParaDuplicar,
              // Ajusta nome/razão social dependendo do tipo
              nome: contatoOriginal.personalidade_juridica === 'Pessoa Física' ? novoNome : dadosParaDuplicar.nome,
              razao_social: contatoOriginal.personalidade_juridica === 'Pessoa Jurídica' ? novoNome : dadosParaDuplicar.razao_social,
              nome_display: novoNome, // Atualiza nome_display também
              // Mantém telefones e emails (a action deve salvá-los)
              telefones: contatoOriginal.telefones || [{ telefone: '', country_code: '+55' }],
              emails: contatoOriginal.emails || [{ email: '' }],
              // Garante que IDs de relacionamento não sejam copiados diretamente
              // (a menos que a lógica da sua action lide com isso)
              conjuge_id: null, // Ou busca o ID novamente se necessário
              // Garante que o criador seja o usuário atual
              criado_por_usuario_id: userId,
              organizacao_id: organizacaoId,
          };

          // 2. Chama a Server Action para CRIAR o novo contato (isEditing = false)
          const result = await saveContactAction({ formData: formDataDuplicado, isEditing: false });

          if (result.error) {
              throw new Error(result.error);
          }
          // 3. Retorna o ID do novo contato criado
          return result.contactId;
      },
      onSuccess: (novoContatoId) => {
          toast.success('Cliente duplicado! Abrindo para edição...');
          // Invalida a query para atualizar a lista no background
          queryClient.invalidateQueries({ queryKey: ['clientesCorretor', organizacaoId, userId, debouncedSearchTerm] });

          // Busca os dados completos do NOVO contato para abrir no modal
          const novoContato = clientes?.find(c => c.id === novoContatoId); // Tenta encontrar na lista atualizada (pode não estar ainda)
          if(novoContato) {
              handleOpenModal(novoContato); // Abre o modal com os dados do duplicado
          } else {
              // Se não encontrou (cache ainda não atualizou), busca do Supabase
              supabase.from('contatos').select(`*, telefones(telefone), emails(email)`).eq('id', novoContatoId).single()
              .then(({data, error}) => {
                  if(data) {
                       handleOpenModal({
                            ...data,
                            telefone: data.telefones?.[0]?.telefone || null,
                            email: data.emails?.[0]?.email || null,
                            nome_display: data.nome || data.razao_social || 'Nome Indefinido',
                            etapa_funil: 'N/A', nome_funil: 'N/A',
                       });
                  } else {
                       console.error("Erro ao buscar dados do contato duplicado:", error);
                       toast.warning("Contato duplicado, mas não foi possível abrir para edição.");
                  }
              });
          }
      },
      onError: (err) => {
          toast.error(`Erro ao duplicar cliente: ${err.message}`);
          console.error("Erro Duplicação:", err);
      },
  });
  // --- FIM DA MUDANÇA ---

  // Notificação (sem mudanças)
  useEffect(() => { /* ... */
    if (!isInitialMount.current) { if (!isFetching && !isError) { if(prevIsFetchingRef.current && !isLoading) { toast.info('Lista atualizada.') } } } else { isInitialMount.current = false } prevIsFetchingRef.current = isFetching;
  }, [isFetching, isError, isLoading])
  const prevIsFetchingRef = useRef(isLoading);

  // Ordenação (sem mudanças)
  const sortedClientes = useMemo(() => { /* ... */
    let sortableItems = [...(clientes || [])]; if (sortConfig.key !== null) { sortableItems.sort((a, b) => { const valA = a[sortConfig.key]; const valB = b[sortConfig.key]; if (valA === null || valA === undefined) return sortConfig.direction === 'ascending' ? 1 : -1; if (valB === null || valB === undefined) return sortConfig.direction === 'ascending' ? -1 : 1; const compareResult = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase()); return sortConfig.direction === 'ascending' ? compareResult : -compareResult; }); } return sortableItems;
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

  // --- MUDANÇA: Função para confirmar e chamar exclusão ---
  const handleDelete = (cliente) => {
      toast.error(
          `Tem certeza que deseja excluir "${cliente.nome_display}"?`,
          {
              action: {
                  label: 'Excluir',
                  onClick: () => deleteMutation.mutate(cliente.id),
              },
              cancel: {
                  label: 'Cancelar',
              },
              duration: 10000, // Tempo maior para confirmação
          }
      );
  };
  // --- FIM DA MUDANÇA ---

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
                <tr key={cliente.id} className="hover:bg-gray-50 group"> {/* Adicionado group para hover dos botões */}
                   <td className="py-2 px-4">
                     {cliente.foto_url ? (<Image src={cliente.foto_url} alt={`Foto ${cliente.nome_display}`} width={40} height={40} className="rounded-full object-cover w-10 h-10" unoptimized />
                     ) : (<FontAwesomeIcon icon={cliente.personalidade_juridica === 'Pessoa Jurídica' ? faBuilding : faUserCircle} className={`w-10 h-10 rounded-full p-2 flex-shrink-0 ${ cliente.personalidade_juridica === 'Pessoa Jurídica' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600' }`} /> )}
                   </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{cliente.nome_display}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.telefone || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{cliente.email || '---'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{cliente.tipo_contato || 'Contato'}</td>
                  <td className="py-3 px-4 text-right">
                     {/* --- MUDANÇA: Botões Editar, Duplicar, Excluir --- */}
                     <div className="flex items-center justify-end space-x-2">
                        {/* Editar */}
                        <button onClick={() => handleOpenModal(cliente)} className="text-blue-600 hover:text-blue-800 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity" title="Editar Cliente">
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        {/* Duplicar */}
                        <button
                            onClick={() => duplicateMutation.mutate(cliente)}
                            disabled={duplicateMutation.isPending}
                            className="text-green-600 hover:text-green-800 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity disabled:text-gray-400"
                            title="Duplicar Cliente"
                        >
                            {duplicateMutation.isPending && duplicateMutation.variables?.id === cliente.id
                             ? <FontAwesomeIcon icon={faSpinner} spin />
                             : <FontAwesomeIcon icon={faCopy} />
                            }
                        </button>
                         {/* Excluir */}
                        <button
                            onClick={() => handleDelete(cliente)}
                            disabled={deleteMutation.isPending && deleteMutation.variables === cliente.id}
                            className="text-red-500 hover:text-red-700 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity disabled:text-gray-400"
                            title="Excluir Cliente"
                        >
                             {deleteMutation.isPending && deleteMutation.variables === cliente.id
                             ? <FontAwesomeIcon icon={faSpinner} spin />
                             : <FontAwesomeIcon icon={faTrash} />
                            }
                        </button>
                     </div>
                     {/* --- FIM DA MUDANÇA --- */}
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
                contactToEdit={contatoParaEditar} // Passa com 'c' minúsculo
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
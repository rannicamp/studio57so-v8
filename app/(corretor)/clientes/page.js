// app/(corretor)/clientes/page.js
'use client' 

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback } from 'react' // Importa useCallback
import {
  useQuery,
  // useMutation, // <-- Não é mais usado aqui
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLayout } from '@/contexts/LayoutContext' 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faSpinner,
  faTimes,
  faUser,
  faBuilding, // <-- Ícone novo
  faAddressBook, // <-- Ícone novo
} from '@fortawesome/free-solid-svg-icons'

// --- IMPORTAÇÃO DO FORMULÁRIO COMPLETO ---
import ContatoForm from '@/components/contatos/ContatoForm'

// 1. Função de busca ATUALIZADA
// Agora ela recebe o ID do usuário para filtrar
async function fetchClientes(userId) {
  // Se o ID do usuário ainda não carregou, retorna uma lista vazia
  if (!userId) {
    return [];
  }
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contatos')
    .select('id, nome, razao_social, tipo_contato, personalidade_juridica') // Pega só o que precisa
    .eq('criado_por_usuario_id', userId) // <-- O FILTRO MÁGICO!
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return data
}

// 2. Função de criação REMOVIDA
// (Agora o ContatoForm cuida disso)
// async function createCliente(novoCliente) { ... }

export default function ClientesCorretor() {
  const queryClient = useQueryClient()
  
  // Pega o 'user' do nosso LayoutContext (que já busca o perfil)
  const { user, isUserLoading } = useLayout()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  // const [novoNome, setNovoNome] = useState('') // <-- Não é mais usado
  const isInitialMount = useRef(true)

  // 3. useQuery ATUALIZADO
  const {
    data: clientes,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    // A chave de cache agora é única para cada usuário
    queryKey: ['clientesCorretor', user?.id], 
    // A função de query agora passa o ID do usuário
    queryFn: () => fetchClientes(user.id),
    // Só executa a query DEPOIS que o user.id estiver disponível
    enabled: !!user?.id, 
  })

  // Lógica de notificação de "Página atualizada" (sem mudança)
  useEffect(() => {
    if (!isInitialMount.current) {
      if (!isFetching) {
        toast.success('Página atualizada!', {
          description: 'Os dados foram sincronizados em segundo plano.',
        })
      }
    } else {
      isInitialMount.current = false
    }
  }, [isFetching])

  // 4. createMutation REMOVIDA
  // const createMutation = useMutation({ ... })

  // 5. handleSubmit REMOVIDO
  // const handleSubmit = (e) => { ... }

  // 6. Nova função de callback para o ContatoForm
  // Isso vai recarregar a lista DEPOIS que o formulário salvar
  const handleSaveSuccess = useCallback(() => {
    setIsModalOpen(false); // Fecha o modal
    toast.success('Contato salvo com sucesso!'); // Feedback
    // Invalida a query para forçar o recarregamento da lista
    queryClient.invalidateQueries({ queryKey: ['clientesCorretor', user?.id] });
  }, [queryClient, user?.id]);

  // Define o estado de "carregando" principal
  const isPageLoading = isLoading || isUserLoading;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          Meus Clientes e Leads
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isPageLoading} // Desabilita se o usuário não carregou
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200 disabled:bg-gray-400"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Novo Contato
        </button>
      </div>

      {isPageLoading ? (
        <div className="text-center py-10">
          <FontAwesomeIcon
            icon={faSpinner}
            className="text-blue-500 text-4xl"
            spin
          />
          <p className="mt-2 text-gray-600">Carregando seus contatos...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Erro!</strong>
          <span className="block sm:inline"> {error.message}</span>
        </div>
      ) : clientes && clientes.length > 0 ? (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {clientes.map((cliente) => (
              <li
                key={cliente.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <div className={`p-3 rounded-full mr-4 ${
                    cliente.personalidade_juridica === 'Pessoa Jurídica'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    <FontAwesomeIcon icon={
                      cliente.personalidade_juridica === 'Pessoa Jurídica'
                        ? faBuilding
                        : faUser
                    } />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {cliente.nome || cliente.razao_social}
                    </p>
                    <p className="text-sm text-gray-500">
                      {cliente.tipo_contato || 'Contato'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <div className="text-center">
            <FontAwesomeIcon icon={faAddressBook} className="text-5xl text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhum contato encontrado</h3>
            <p className="text-gray-500 text-sm mt-1">
              Você ainda não cadastrou nenhum contato.
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Clique em &quot;Novo Contato&quot; para começar.
            </p>
          </div>
        </div>
      )}

      {/* --- 7. MODAL ATUALIZADO --- */}
      {/* Agora ele usa o ContatoForm completo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
          {/* Aumentamos o tamanho do modal para o formulário caber */}
          <div className="bg-white p-0 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col">
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white rounded-t-lg">
              <h3 className="text-2xl font-bold text-gray-800">
                Cadastrar Novo Contato
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>
            
            {/* Conteúdo do Modal (o formulário) */}
            <div className="flex-grow overflow-y-auto">
              <ContatoForm 
                onClose={() => setIsModalOpen(false)}
                onSaveSuccess={handleSaveSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// app/(corretor)/clientes/page.js

// LINHA MOVIDA PARA O TOPO!
export const dynamic = 'force-dynamic'

'use client' // Agora vem depois

import React, { useState, useEffect, useRef } from 'react'
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
  faPlus,
  faSpinner,
  faTimes,
  faUser,
} from '@fortawesome/free-solid-svg-icons'

// ... (o restante do código continua igual) ...

// 1. Função de busca
async function fetchClientes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contatos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return data
}

// 2. Função de criação
async function createCliente(novoCliente) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contatos')
    .insert(novoCliente)
    .select()

  if (error) {
    throw new Error(error.message)
  }
  return data
}

export default function ClientesCorretor() {
  const queryClient = useQueryClient()
  const { user } = useLayout()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const isInitialMount = useRef(true)

  const {
    data: clientes,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['clientesCorretor'],
    queryFn: fetchClientes,
  })

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

  const createMutation = useMutation({
    mutationFn: createCliente,
    onSuccess: () => {
      toast.success('Cliente cadastrado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['clientesCorretor'] })
      setIsModalOpen(false)
      setNovoNome('')
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar cliente:', error.message)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!user) {
      toast.error('Você não está logado.')
      return
    }
    if (!novoNome) {
      toast.error('O nome é obrigatório.')
      return
    }
    const novoCliente = {
      nome: novoNome,
      criado_por_usuario_id: user.id,
      tipo_contato: 'Pessoa Física',
    }
    createMutation.mutate(novoCliente)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          Meus Clientes e Leads
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Novo Cliente
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <FontAwesomeIcon
            icon={faSpinner}
            className="text-blue-500 text-4xl"
            spin
          />
          <p className="mt-2 text-gray-600">Carregando seus clientes...</p>
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
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {cliente.nome}
                    </p>
                    <p className="text-sm text-gray-500">
                      ID: {cliente.id}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            Nenhum cliente cadastrado por você ainda.
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Clique em &quot;Novo Cliente&quot; para começar.
          </p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-800">
                Cadastrar Novo Cliente
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} size="lg" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="nome"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  id="nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Ranniere Campos"
                  required
                />
              </div>
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mr-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200 disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <FontAwesomeIcon icon={faSpinner} className="mr-2" spin />
                  ) : (
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  )}
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
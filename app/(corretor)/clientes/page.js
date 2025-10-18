// app/(corretor)/clientes/page.js
'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import { useLayout } from '@/contexts/LayoutContext' // Para buscar o usuário logado
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faSpinner,
  faTimes,
  faUser,
} from '@fortawesome/free-solid-svg-icons'

// 1. Função de busca (separada, como manda a Regra 6.a)
// A RLS (Passo 2) garante que esta função SÓ retorne
// os contatos do corretor que está logado.
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

// 2. Função de criação (para o useMutation)
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
  const { user } = useLayout() // Pegamos o usuário do nosso contexto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')

  // Ref para controlar a notificação de atualização
  const isInitialMount = useRef(true)

  // 3. Hook useQuery para buscar os dados
  const {
    data: clientes,
    isLoading,
    isFetching, // "isFetching" é true quando a busca em 2º plano acontece
    isError,
    error,
  } = useQuery({
    queryKey: ['clientesCorretor'], // Chave única para este cache
    queryFn: fetchClientes,
  })

  // 4. Efeito para a Notificação de Atualização
  useEffect(() => {
    // Se não for a primeira carga da página
    if (!isInitialMount.current) {
      // E se a busca em segundo plano (isFetching) acabou de terminar
      if (!isFetching) {
        toast.success('Página atualizada!', {
          description: 'Os dados foram sincronizados em segundo plano.',
        })
      }
    } else {
      // Marca que a primeira carga já passou
      isInitialMount.current = false
    }
  }, [isFetching]) // Roda sempre que 'isFetching' mudar

  // 5. Hook useMutation para criar o cliente
  const createMutation = useMutation({
    mutationFn: createCliente,
    onSuccess: () => {
      toast.success('Cliente cadastrado com sucesso!')
      // Invalida o cache 'clientesCorretor' para forçar o useQuery a rodar de novo
      queryClient.invalidateQueries({ queryKey: ['clientesCorretor'] })
      setIsModalOpen(false) // Fecha o modal
      setNovoNome('') // Limpa o formulário
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar cliente:', error.message)
    },
  })

  // 6. Função para lidar com o envio do formulário
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

    // Monta o objeto para o Supabase, incluindo a "etiqueta" do criador
    const novoCliente = {
      nome: novoNome,
      criado_por_usuario_id: user.id, // AQUI está a ligação com o corretor!
      tipo_contato: 'Pessoa Física', // Um valor padrão
    }

    createMutation.mutate(novoCliente)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Meus Clientes e Leads</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* 7. Lógica de exibição (Carregando, Erro, Dados) */}
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
                {/* TODO: Adicionar botões de editar/ver detalhes */}
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
            {/* CORREÇÃO AQUI! 
              Trocamos "Novo Cliente" por &quot;Novo Cliente&quot; 
            */}
            Clique em &quot;Novo Cliente&quot; para começar.
          </p>
        </div>
      )}

      {/* 8. Modal de Cadastro Simples */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-800">Cadastrar Novo Cliente</h3>
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
              {/* Por enquanto, só pedimos o nome para provar o conceito */}
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
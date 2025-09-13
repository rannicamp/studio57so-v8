// components/EmpresaList.js

"use client";

// --------------------------------------------------------------------------------
// IMPORTAÇÕES
// --------------------------------------------------------------------------------
// Hooks do React para gerenciar estado local e otimizar cálculos
import { useState, useMemo } from 'react';
// Função para criar um cliente Supabase
import { createClient } from '../utils/supabase/client';
// Hook do Next.js para navegação
import { useRouter } from 'next/navigation';
// Hooks do TanStack Query para buscar e alterar dados do servidor
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Hook do nosso contexto de autenticação para dados do usuário
import { useAuth } from '../contexts/AuthContext';
// Biblioteca para exibir notificações (toasts)
import { toast } from 'sonner';
// Ícones da biblioteca FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';

// --------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------------------------
// A prop 'initialEmpresas' foi removida, pois agora buscamos os dados dinamicamente.
export default function EmpresaList({ isAdmin }) {
  // --------------------------------------------------------------------------------
  // HOOKS E ESTADOS
  // --------------------------------------------------------------------------------
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient(); // Para invalidar o cache
  const { userData } = useAuth(); // Para pegar a organização do usuário
  const [searchTerm, setSearchTerm] = useState(''); // Estado para o campo de busca

  // --------------------------------------------------------------------------------
  // BUSCA DE DADOS COM useQuery
  // --------------------------------------------------------------------------------
  // Busca a lista de empresas da organização do usuário logado.
  // A lista se mantém atualizada automaticamente.
  const { data: empresas = [], isLoading, isError } = useQuery({
    queryKey: ['empresas', userData?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cadastro_empresa')
        .select('*')
        .eq('organizacao_id', userData.organizacao_id)
        .order('razao_social', { ascending: true });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userData?.organizacao_id, // A query só roda quando o ID da organização estiver disponível
  });

  // --------------------------------------------------------------------------------
  // MUTATION PARA DELETAR DADOS
  // --------------------------------------------------------------------------------
  // Gerencia o processo de exclusão de uma empresa.
  const { mutate: deleteEmpresa } = useMutation({
    mutationFn: async (empresaId) => {
      const { error } = await supabase.from('cadastro_empresa').delete().eq('id', empresaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Empresa excluída com sucesso!');
      // Invalida a query 'empresas', o que faz o useQuery buscar os dados novamente,
      // atualizando a lista na tela automaticamente.
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // --------------------------------------------------------------------------------
  // MANIPULADORES DE EVENTOS
  // --------------------------------------------------------------------------------
  // Função que inicia o processo de exclusão com uma confirmação via toast.
  const handleDelete = (empresaId) => {
    toast("Você tem certeza?", {
      description: "Esta ação não poderá ser desfeita.",
      action: {
        label: "Sim, excluir",
        onClick: () => deleteEmpresa(empresaId),
      },
      cancel: {
        label: "Cancelar",
      },
    });
  };

  // --------------------------------------------------------------------------------
  // LÓGICA DE FILTRO
  // --------------------------------------------------------------------------------
  // Memoiza o resultado do filtro para evitar recálculos desnecessários.
  // Opera sobre os dados "vivos" fornecidos pelo useQuery.
  const filteredEmpresas = useMemo(() => {
    if (!searchTerm) return empresas;
    return empresas.filter(emp =>
      emp.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.nome_fantasia && emp.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.cnpj && emp.cnpj.includes(searchTerm))
    );
  }, [empresas, searchTerm]);


  // --------------------------------------------------------------------------------
  // RENDERIZAÇÃO CONDICIONAL
  // --------------------------------------------------------------------------------
  if (isLoading) {
    return (
        <div className="flex justify-center items-center p-8">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
            <span className="ml-4 text-lg text-gray-600">Carregando empresas...</span>
        </div>
    );
  }

  if (isError) {
    return (
        <div className="flex justify-center items-center p-8 bg-red-50 border border-red-200 rounded-md">
            <FontAwesomeIcon icon={faExclamationTriangle} size="2x" className="text-red-500" />
            <span className="ml-4 text-lg text-red-700">Ocorreu um erro ao buscar os dados.</span>
        </div>
    );
  }
  
  // --------------------------------------------------------------------------------
  // RENDERIZAÇÃO PRINCIPAL (JSX)
  // --------------------------------------------------------------------------------
  return (
    <div className="space-y-4 p-4">
      <input
        type="text"
        placeholder="Buscar por Razão Social, Nome Fantasia ou CNPJ..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="p-2 border rounded-md w-full max-w-lg shadow-sm"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Razão Social</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Nome Fantasia</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">CNPJ</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Telefone</th>
              <th className="relative px-6 py-3 text-right text-xs font-medium uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmpresas.length > 0 ? (
                filteredEmpresas.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{emp.razao_social}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.nome_fantasia || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.cnpj}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{emp.telefone || '-'}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                        <button onClick={() => router.push(`/empresas/editar/${emp.id}`)} className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1">
                            <FontAwesomeIcon icon={faPenToSquare} /> Editar
                        </button>
                        {isAdmin && (
                        <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1">
                            <FontAwesomeIcon icon={faTrash} /> Excluir
                        </button>
                        )}
                    </td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                        Nenhuma empresa encontrada.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é responsável por exibir, buscar e permitir a exclusão de empresas
// cadastradas na plataforma.
//
// Funcionalidades Principais:
// - Busca de Dados Dinâmica: O componente foi refatorado para usar `useQuery`,
//   buscando a lista de empresas diretamente do Supabase e garantindo que ela
//   esteja sempre sincronizada e filtrada pela organização do usuário.
// - Exclusão Reativa: A função de excluir foi movida para um `useMutation`.
//   Isso simplifica o código e, mais importante, invalida automaticamente o cache
//   da lista de empresas após uma exclusão, fazendo com que a UI se atualize em
//   tempo real sem a necessidade de recarregar a página.
// - Experiência do Usuário Aprimorada: Os `alert()` e `confirm()` nativos do
//   navegador foram substituídos por notificações `toast`, oferecendo uma
//   interface mais moderna e não-bloqueante para confirmações e feedbacks.
// - Filtragem Otimizada: A busca na lista continua sendo feita no lado do cliente,
//   mas agora utiliza o hook `useMemo` para garantir que a filtragem só seja
//   recalculada quando a lista de empresas ou o termo de busca realmente mudarem.
// --------------------------------------------------------------------------------
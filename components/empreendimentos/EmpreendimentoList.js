// components/EmpreendimentoList.js

"use client";

// --------------------------------------------------------------------------------
// IMPORTAÇÕES
// --------------------------------------------------------------------------------
// Hook do React para gerenciar estado local (como o termo de busca)
import { useState } from 'react';
// Componente do Next.js para navegação otimizada entre páginas
import Link from 'next/link';
// Ícones da biblioteca FontAwesome para deixar a interface mais bonita
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faEye, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
// Hook do TanStack Query para buscar, cachear e sincronizar dados do servidor
import { useQuery } from '@tanstack/react-query';
// Função para criar um cliente Supabase para interagir com o banco de dados
import { createClient } from '../../utils/supabase/client';
// Hook do nosso contexto de autenticação para pegar dados do usuário logado
import { useAuth } from '../../contexts/AuthContext';


// --------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------------------------
// Removemos 'initialEmpreendimentos' dos props, pois o componente agora busca seus próprios dados.
export default function EmpreendimentoList() {
  // --------------------------------------------------------------------------------
  // ESTADOS E HOOKS
  // --------------------------------------------------------------------------------
  // Estado para armazenar o que o usuário digita no campo de busca
  const [searchTerm, setSearchTerm] = useState('');
  // Instância do cliente Supabase
  const supabase = createClient();
  // Hook para pegar os dados do usuário logado, principalmente o 'organizacao_id'
  const { userData } = useAuth();

  // --------------------------------------------------------------------------------
  // BUSCA DE DADOS COM useQuery (A FORMA MODERNA)
  // --------------------------------------------------------------------------------
  // Esta é a principal mudança. Usamos useQuery para buscar os empreendimentos.
  // - queryKey: Uma chave única para esta busca. O TanStack Query usa isso para cache.
  //   Incluímos o 'organizacao_id' na chave para que, se o usuário mudar de organização,
  //   uma nova busca seja feita automaticamente.
  // - queryFn: A função assíncrona que realmente busca os dados no Supabase.
  // - enabled: A busca só será executada quando 'userData.organizacao_id' existir.
  //
  // O useQuery nos dá de graça:
  // - 'data': Os dados buscados (renomeamos para 'empreendimentos' e demos um valor padrão de []).
  // - 'isLoading': Um booleano que é true enquanto os dados estão sendo buscados.
  // - 'isError': Um booleano que é true se a busca falhar.
  const { data: empreendimentos = [], isLoading, isError } = useQuery({
    queryKey: ['empreendimentos', userData?.organizacao_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select(`
          id,
          nome,
          status,
          empresa_proprietaria:contatos ( razao_social )
        `)
        .eq('organizacao_id', userData.organizacao_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!userData?.organizacao_id,
  });

  // --------------------------------------------------------------------------------
  // LÓGICA DE FILTRO E ESTILIZAÇÃO
  // --------------------------------------------------------------------------------
  // Filtra a lista de empreendimentos com base no termo de busca digitado.
  // Esta lógica permanece a mesma, mas agora opera sobre os dados "ao vivo" do useQuery.
  const filteredEmpreendimentos = empreendimentos.filter(empreendimento =>
    empreendimento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (empreendimento.empresa_proprietaria?.razao_social && empreendimento.empresa_proprietaria.razao_social.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Função para retornar a classe CSS correta com base no status do empreendimento
  const getStatusClass = (status) => {
    switch (status) {
      case 'Em Obras':
        return 'bg-blue-100 text-blue-800';
      case 'Em Lançamento':
        return 'bg-yellow-100 text-yellow-800';
      case 'Entregue':
        return 'bg-green-100 text-green-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // --------------------------------------------------------------------------------
  // RENDERIZAÇÃO CONDICIONAL
  // --------------------------------------------------------------------------------
  // Exibe uma mensagem de carregamento enquanto os dados estão sendo buscados.
  if (isLoading) {
    return (
        <div className="flex justify-center items-center p-8">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
            <span className="ml-4 text-lg text-gray-600">Carregando empreendimentos...</span>
        </div>
    );
  }

  // Exibe uma mensagem de erro se a busca falhar.
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
    <div className="p-4">
      <input
        type="text"
        placeholder="Buscar por nome do empreendimento ou empresa..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-4 border border-gray-300 rounded-md"
      />
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome do Empreendimento</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa Proprietária</th>
              <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEmpreendimentos.length > 0 ? (
                filteredEmpreendimentos.map((empreendimento) => (
                <tr key={empreendimento.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6 whitespace-nowrap font-medium text-gray-900">{empreendimento.nome}</td>
                    <td className="py-4 px-6 whitespace-nowrap text-gray-500">{empreendimento.empresa_proprietaria?.razao_social || 'N/A'}</td>
                    <td className="py-4 px-6 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(empreendimento.status)}`}>
                        {empreendimento.status}
                    </span>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/empreendimentos/${empreendimento.id}`} className="text-green-600 hover:text-green-900 mr-4">
                        <FontAwesomeIcon icon={faEye} className="mr-1" /> Visualizar
                    </Link>
                    <Link href={`/empreendimentos/editar/${empreendimento.id}`} className="text-indigo-600 hover:text-indigo-900">
                        <FontAwesomeIcon icon={faPenToSquare} className="mr-1" /> Editar
                    </Link>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-500">
                        Nenhum empreendimento encontrado.
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
// Este componente é responsável por exibir a lista de todos os empreendimentos.
//
// Funcionalidades Principais:
// - Busca de dados dinâmica: Em vez de receber uma lista estática, o componente
//   agora usa o hook `useQuery` para buscar os dados diretamente do Supabase em
//   tempo real, filtrando-os pelo `organizacao_id` do usuário logado.
// - Reatividade automática: Graças ao `useQuery`, a lista se atualiza
//   automaticamente quando um novo empreendimento é criado ou alterado em outro
//   lugar do sistema (como no `EmpreendimentoForm`), sem a necessidade de recarregar a página.
// - Feedback ao usuário: Exibe indicadores visuais de "carregando" e "erro",
//   melhorando a experiência do usuário durante a busca de dados.
// - Busca e Filtragem: Possui um campo de busca que filtra a lista pelo nome
//   do empreendimento ou pela razão social da empresa proprietária.
// - Ações Rápidas: Fornece links diretos para visualizar os detalhes ou editar
//   cada empreendimento da lista.
// --------------------------------------------------------------------------------
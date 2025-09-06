// O PORQUÊ: Importamos o 'useQuery' do TanStack Query, que é a biblioteca de cache.
// Ele que vai buscar e "lembrar" dos dados para nós.
"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../../../utils/supabase/client';
import RdoListManager from '../../../../components/RdoListManager';
import Link from 'next/link';
import RdoPhotoGallery from '../../../../components/RdoPhotoGallery';

// O PORQUÊ: Criamos funções separadas e assíncronas para cada busca de dados.
// O 'useQuery' usará essas funções. Cada uma é responsável por buscar uma
// única coisa: uma para os RDOs, outra para os empreendimentos, etc.
// Isso mantém o código organizado e permite que o cache funcione individualmente para cada tipo de dado.
const fetchRdos = async (supabase) => {
  const { data, error } = await supabase
    .from('diarios_obra')
    .select('*, empreendimentos(nome), usuarios(nome, sobrenome)')
    .order('data_relatorio', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchEmpreendimentos = async (supabase) => {
  const { data, error } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome');
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchResponsaveis = async (supabase) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, sobrenome')
    .order('nome');
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchPhotos = async (supabase) => {
  const { data, error } = await supabase
    .from('rdo_fotos_uploads')
    .select('*, diarios_obra (id, rdo_numero, data_relatorio)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};


export default function ManageRdosPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('lista');

  // O PORQUÊ: Aqui está a mágica! Substituímos o 'useState' e 'useEffect' gigantes
  // por chamadas ao 'useQuery'. Cada 'useQuery' recebe:
  // 1. 'queryKey': Uma "etiqueta" única para esses dados. O React Query usa isso para saber o que guardar no cache.
  // 2. 'queryFn': A função que ele deve executar para buscar os dados (as que criamos ali em cima).
  // O hook nos retorna o estado: 'data' (os dados), 'isLoading' (se está buscando) e 'error' (se deu erro).
  const { data: rdos, isLoading: isLoadingRdos, error: errorRdos } = useQuery({
    queryKey: ['rdos'],
    queryFn: () => fetchRdos(supabase),
  });

  const { data: empreendimentos, isLoading: isLoadingEmpreendimentos, error: errorEmpreendimentos } = useQuery({
    queryKey: ['empreendimentos'],
    queryFn: () => fetchEmpreendimentos(supabase),
  });
  
  const { data: responsaveis, isLoading: isLoadingResponsaveis, error: errorResponsaveis } = useQuery({
    queryKey: ['responsaveis'],
    queryFn: () => fetchResponsaveis(supabase),
  });

  const { data: photos, isLoading: isLoadingPhotos, error: errorPhotos } = useQuery({
    queryKey: ['rdoPhotos'],
    queryFn: () => fetchPhotos(supabase),
  });

  // O PORQUÊ: Simplificamos a verificação de carregamento e erro.
  // Se qualquer uma das buscas estiver em andamento, mostramos "Carregando...".
  const isLoading = isLoadingRdos || isLoadingEmpreendimentos || isLoadingResponsaveis || isLoadingPhotos;
  const error = errorRdos || errorEmpreendimentos || errorResponsaveis || errorPhotos;

  if (isLoading) {
    return <div className="text-center p-8">Carregando dados...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">Erro ao carregar dados: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Diários de Obra</h1>
        <Link href="/rdo" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo RDO
        </Link>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('lista')}
            className={`${
              activeTab === 'lista'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Lista de RDOs
          </button>
          <button
            onClick={() => setActiveTab('fotos')}
            className={`${
              activeTab === 'fotos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Relatório Fotográfico
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'lista' && (
          <RdoListManager 
            initialRdos={rdos || []}
            empreendimentosList={empreendimentos || []}
            responsaveisList={responsaveis || []}
          />
        )}
        
        {activeTab === 'fotos' && (
          <RdoPhotoGallery photos={photos || []} />
        )}
      </div>
    </div>
  );
}
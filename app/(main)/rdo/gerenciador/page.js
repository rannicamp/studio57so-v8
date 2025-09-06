// O PORQUÊ: Precisamos do 'useState' e 'useEffect' para controlar qual aba está ativa
// e carregar os dados. Como esta página agora terá estado, ela precisa ser um Componente de Cliente.
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import RdoListManager from '../../../../components/RdoListManager';
import Link from 'next/link';
// O PORQUÊ: Importamos o novo componente da galeria que acabamos de criar.
import RdoPhotoGallery from '../../../../components/RdoPhotoGallery';

export default function ManageRdosPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('lista'); // 'lista' ou 'fotos'

  // O PORQUÊ: Usaremos 'useState' e 'useEffect' para carregar os dados
  // no lado do cliente, já que a página agora é interativa ("use client").
  const [rdos, setRdos] = useState([]);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Promise.all executa todas as buscas de dados em paralelo para mais eficiência.
      try {
        const [
          rdosResponse,
          empreendimentosResponse,
          responsaveisResponse,
          photosResponse,
        ] = await Promise.all([
          // 1. Busca os RDOs e os dados relacionados
          supabase
            .from('diarios_obra')
            .select('*, empreendimentos(nome), usuarios(nome, sobrenome)')
            .order('data_relatorio', { ascending: false }),
          
          // 2. Busca a lista de todos os empreendimentos para o filtro
          supabase
            .from('empreendimentos')
            .select('id, nome')
            .order('nome'),

          // 3. Busca a lista de todos os usuários para o filtro de responsáveis
          supabase
            .from('usuarios')
            .select('id, nome, sobrenome')
            .order('nome'),

          // 4. (NOVO) Busca todas as fotos e os dados do RDO associado
          // O PORQUÊ: Esta é a nova consulta. Ela pega cada foto da tabela 'rdo_fotos_uploads'
          // e, através do 'diario_obra_id', busca o ID, número e data do RDO correspondente.
          // Ordenamos por 'created_at' em ordem decrescente para mostrar as mais novas primeiro.
          supabase
            .from('rdo_fotos_uploads')
            .select(`
              *,
              diarios_obra (
                id,
                rdo_numero,
                data_relatorio
              )
            `)
            .order('created_at', { ascending: false }),
        ]);

        // Verifica se alguma das promises retornou erro
        if (rdosResponse.error) throw rdosResponse.error;
        if (empreendimentosResponse.error) throw empreendimentosResponse.error;
        if (responsaveisResponse.error) throw responsaveisResponse.error;
        if (photosResponse.error) throw photosResponse.error;
        
        setRdos(rdosResponse.data || []);
        setEmpreendimentos(empreendimentosResponse.data || []);
        setResponsaveis(responsaveisResponse.data || []);
        setPhotos(photosResponse.data || []);

      } catch (err) {
        console.error('Erro ao buscar dados para o gerenciador de RDO:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  if (loading) {
    return <div className="text-center p-8">Carregando dados...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">Erro ao carregar dados: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Diários de Obra</h1>
        <Link href="/rdo" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo RDO
        </Link>
      </div>

      {/* O PORQUÊ: Aqui criamos a navegação das abas. */}
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

      {/* O PORQUÊ: O conteúdo exibido depende da aba que está ativa. */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'lista' && (
          <RdoListManager 
            initialRdos={rdos}
            empreendimentosList={empreendimentos}
            responsaveisList={responsaveis}
          />
        )}
        
        {activeTab === 'fotos' && (
          // O PORQUÊ: Renderiza o componente da galeria, passando a lista de fotos que buscamos.
          <RdoPhotoGallery photos={photos} />
        )}
      </div>
    </div>
  );
}
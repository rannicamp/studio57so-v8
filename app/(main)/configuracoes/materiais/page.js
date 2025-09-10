"use client";

import { useEffect } from 'react';
import { createClient } from '../../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';
import MaterialManager from '../../../../components/MaterialManager';

// Função para buscar os materiais, agora usada pelo useQuery
const fetchMaterials = async (supabase) => {
  const { data, error } = await supabase
    .from('materiais')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    throw new Error('Erro ao buscar materiais: ' + error.message);
  }
  return data || [];
};

export default function GestaoMateriaisPage() {
  const supabase = createClient();
  const router = useRouter();
  const { hasPermission, loading: authLoading } = useAuth();

  // Usamos o sistema de permissões para verificar o acesso
  // (Assumindo que o recurso se chama 'materiais', ajuste se for outro nome)
  const canViewPage = hasPermission('materiais', 'pode_ver');

  // Busca os materiais de forma inteligente com useQuery
  const { data: materials, isLoading, isError, error } = useQuery({
    queryKey: ['materials'],
    queryFn: () => fetchMaterials(supabase),
    enabled: canViewPage, // Só busca os dados se o usuário tiver permissão
  });

  // Redireciona se o usuário não tiver permissão
  useEffect(() => {
    if (!authLoading && !canViewPage) {
      router.push('/');
    }
  }, [authLoading, canViewPage, router]);

  if (authLoading || isLoading) {
    return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
  }

  if (!canViewPage) {
    return (
        <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
            <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
            <p className="mt-2 text-red-600">Você não tem permissão para acessar esta página.</p>
        </div>
    );
  }

  if (isError) {
      return <div className="text-center p-10 text-red-600">Falha ao carregar materiais: {error.message}</div>
  }

  return (
    <div className="space-y-6">
      <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para Configurações
      </Link>
      <h1 className="text-3xl font-bold text-gray-900">Gestão de Materiais</h1>
      <p className="text-gray-600">
        Gerencie sua base de dados de materiais, realize importações, exportações e limpezas.
      </p>
      
      <div className="bg-white rounded-lg shadow p-6">
        <MaterialManager initialMaterials={materials || []} />
      </div>
    </div>
  );
}
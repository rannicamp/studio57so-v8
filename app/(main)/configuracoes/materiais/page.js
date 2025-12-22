//app/(main)/configuracoes/materiais/page.js
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

// =================================================================================
// CORREÇÃO DE SEGURANÇA (organização_id)
// O PORQUÊ: A função agora recebe o `organizacaoId` para filtrar a busca.
// Isso garante que apenas os materiais da organização correta sejam retornados.
// =================================================================================
const fetchMaterials = async (supabase, organizacaoId) => {
    // Se não houver ID da organização, não retorna nada para evitar vazamento de dados.
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('materiais')
        .select('*')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('nome', { ascending: true });

    if (error) {
        throw new Error('Erro ao buscar materiais: ' + error.message);
    }
    return data || [];
};

export default function GestaoMateriaisPage() {
    const supabase = await createClient();
    const router = useRouter();
    // Pegamos o usuário completo para ter acesso ao organizacao_id
    const { user, hasPermission, loading: authLoading } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const canViewPage = hasPermission('materiais', 'pode_ver');

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA E BOAS PRÁTICAS
    // O PORQUÊ:
    // 1. O `queryKey` agora inclui `organizacaoId`. Isso garante que se o usuário
    //    trocar de organização, os dados serão buscados novamente.
    // 2. A função `fetchMaterials` agora recebe o `organizacaoId`.
    // 3. A query só é ativada (`enabled`) se tivermos a permissão E o `organizacaoId`.
    // =================================================================================
    const { data: materials, isLoading, isError, error } = useQuery({
        queryKey: ['materials', organizacaoId],
        queryFn: () => fetchMaterials(supabase, organizacaoId),
        enabled: canViewPage && !!organizacaoId, 
    });

    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);

    // A condição de carregamento agora inclui a verificação do `organizacaoId`
    if (authLoading || (canViewPage && isLoading)) {
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
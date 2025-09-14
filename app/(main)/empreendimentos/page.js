//app/(main)/empreendimentos/page.js
"use client";

import { useEffect } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import EmpreendimentoList from '../../../components/EmpreendimentoList';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // 1. Importar useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A busca foi isolada e agora exige o `organizacaoId` para filtrar os
// empreendimentos, garantindo que cada usuário veja apenas os de sua empresa.
// =================================================================================
const fetchEmpreendimentos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('empreendimentos')
        .select(`
            id,
            nome,
            status,
            empresa_proprietaria:empresa_proprietaria_id ( razao_social )
        `)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('nome');
    
    if (error) {
        console.error('Erro ao buscar empreendimentos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

export default function GerenciamentoEmpreendimentosPage() {
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();
    
    // Pegamos o usuário completo para ter acesso ao organizacao_id
    const { user, hasPermission, loading: authLoading } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const canView = hasPermission('empreendimentos', 'pode_ver');
    const canCreate = hasPermission('empreendimentos', 'pode_criar');

    // Redireciona se o usuário não tiver permissão (lógica movida para fora do fetch)
    useEffect(() => {
        if (!authLoading && !canView) {
            router.push('/');
        }
    }, [authLoading, canView, router]);

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia o estado de carregamento, erros e cache de
    // forma mais eficiente, simplificando o nosso código.
    // =================================================================================
    const { data: empreendimentos = [], isLoading: loadingData, isError, error } = useQuery({
        queryKey: ['empreendimentos', organizacaoId],
        queryFn: () => fetchEmpreendimentos(supabase, organizacaoId),
        enabled: canView && !!organizacaoId, // A query só é ativada se tiver permissão E o organizacaoId
    });

    const handleActionComplete = () => {
        queryClient.invalidateQueries({ queryKey: ['empreendimentos', organizacaoId] });
    };

    if (authLoading || (canView && loadingData)) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p className="mt-2">Carregando...</p>
            </div>
        );
    }
    
    if (!canView) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para visualizar esta página.</p>
            </div>
        );
    }

    if (isError) {
        return <p className="p-4 text-center text-red-500">Erro ao carregar empreendimentos: {error.message}</p>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empreendimentos</h1>
                {canCreate && (
                    <Link href="/empreendimentos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                        + Novo Empreendimento
                    </Link>
                )}
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
                <EmpreendimentoList 
                    initialEmpreendimentos={empreendimentos}
                    onActionComplete={handleActionComplete}
                />
            </div>
        </div>
    );
}
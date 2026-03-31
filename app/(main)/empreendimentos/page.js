// app/(main)/empreendimentos/page.js
"use client";

import { useEffect } from 'react';
import { createClient } from '../../../utils/supabase/client';
import EmpreendimentoManager from '../../../components/empreendimentos/EmpreendimentoManager';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

const fetchEmpreendimentos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('empreendimentos')
        .select(`
            id,
            nome,
            status,
            imagem_capa_url,
            listado_para_venda, 
            empresa_proprietaria:empresa_proprietaria_id ( razao_social )
        `)
        .eq('organizacao_id', organizacaoId)
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

    const { user, hasPermission, loading: authLoading } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const canView = hasPermission('empreendimentos', 'pode_ver');

    useEffect(() => {
        if (!authLoading && !canView) {
            router.push('/');
        }
    }, [authLoading, canView, router]);

    const { data: empreendimentos = [], isLoading: loadingData, isError, error } = useQuery({
        queryKey: ['empreendimentos', organizacaoId],
        queryFn: () => fetchEmpreendimentos(supabase, organizacaoId),
        enabled: canView && !!organizacaoId,
    });

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
        <div className="p-4 md:p-6 lg:p-8">
            <EmpreendimentoManager initialEmpreendimentos={empreendimentos || []} />
        </div>
    );
}
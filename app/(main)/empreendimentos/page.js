// app/(main)/empreendimentos/page.js
"use client";

import { useEffect } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import EmpreendimentoCard from '../../../components/empreendimentos/EmpreendimentoCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock, faBuilding } from '@fortawesome/free-solid-svg-icons';

// ======================= CORREÇÃO AQUI =======================
// O PORQUÊ: O comentário foi REMOVIDO de dentro da string do select.
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
        `) // <--- O comentário foi removido daqui
        .eq('organizacao_id', organizacaoId)
        .order('nome');

    if (error) {
        console.error('Erro ao buscar empreendimentos:', error);
        throw new Error(error.message);
    }
    return data || [];
};
// ======================= FIM DA CORREÇÃO =======================

export default function GerenciamentoEmpreendimentosPage() {
    // CORREÇÃO: Removido 'await' aqui (Componente de Cliente)
    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    const { user, hasPermission, loading: authLoading } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const canView = hasPermission('empreendimentos', 'pode_ver');
    const canCreate = hasPermission('empreendimentos', 'pode_criar');

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">
                    Gerenciamento de Empreendimentos
                </h1>
                {canCreate && (
                    <Link
                        href="/empreendimentos/cadastro"
                        className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 transition-colors w-full sm:w-auto text-center"
                    >
                        + Novo Empreendimento
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-lg shadow">
                {empreendimentos.length > 0 ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {empreendimentos.map((empreendimento) => (
                            <EmpreendimentoCard
                                key={empreendimento.id}
                                empreendimento={empreendimento}
                                organizacaoId={organizacaoId}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-10">
                        <FontAwesomeIcon icon={faBuilding} size="3x" className="text-gray-400 mb-4" />
                        <h2 className="text-xl font-semibold text-gray-700">Nenhum empreendimento encontrado</h2>
                        <p className="mt-2 text-gray-500">
                            {canCreate ? "Que tal cadastrar o primeiro?" : "Parece que ainda não há empreendimentos para exibir."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
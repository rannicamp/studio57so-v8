// app/(main)/financeiro/conciliacao/page.js
"use client";

import Link from 'next/link';
import { createClient } from '../../../../utils/supabase/client';
import { useAuth } from '../../../../contexts/AuthContext'; // 1. Importar useAuth
import { useQuery } from '@tanstack/react-query'; // 2. Importar useQuery
import ConciliacaoManager from '../../../../components/financeiro/ConciliacaoManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A busca foi isolada e agora exige o `organizacaoId` para filtrar as
// contas, garantindo que cada usuário veja apenas as contas de sua empresa.
// =================================================================================
const fetchContas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('nome');
    
    if (error) {
        console.error("Erro ao buscar contas:", error);
        throw new Error(error.message);
    }
    return data || [];
};

export default function ConciliacaoPage() {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia o estado de carregamento, erros e cache de
    // forma mais eficiente e automática, simplificando o nosso código.
    // =================================================================================
    const { data: contas = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ['contasFinanceiras', organizacaoId],
        queryFn: () => fetchContas(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });

    return (
        <div className="space-y-6">
            <Link href="/financeiro" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para o Painel Financeiro
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 uppercase">Conciliação Bancária</h1>
            <p className="text-gray-600">
                Importe seu extrato bancário em formato OFX e concilie automaticamente com os lançamentos do sistema.
            </p>
            <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                {loading ? (
                    <div className="text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                        <p className="mt-2">Carregando contas...</p>
                    </div>
                ) : isError ? (
                     <p className="p-4 text-center text-red-500">Erro ao carregar contas: {error.message}</p>
                ) : (
                    <ConciliacaoManager contas={contas} />
                )}
            </div>
        </div>
    );
}
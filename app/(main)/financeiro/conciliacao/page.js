// app/(main)/financeiro/conciliacao/page.js
"use client";

import Link from 'next/link';
import { createClient } from '../../../../utils/supabase/client';
import { useAuth } from '../../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import ConciliacaoManager from '../../../../components/financeiro/conciliacao'; // Aponta para a pasta, que carrega o index.js
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Função de busca atualizada
const fetchContas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];

    const { data, error } = await supabase
        .from('contas_financeiras')
        // ADICIONEI 'tipo' AQUI POIS É O CAMPO QUE VAMOS USAR PARA A REGRA
        .select('id, nome, tipo, belvo_link_id, belvo_account_id, instituicao') 
        .eq('organizacao_id', organizacaoId)
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
                Importe seu extrato bancário via OFX ou conecte-se via Open Finance (Belvo) para conciliação automática.
            </p>
            <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                {loading ? (
                    <div className="text-center p-10">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                        <p className="mt-2">Carregando contas...</p>
                    </div>
                ) : isError ? (
                     <p className="p-4 text-center text-red-500">Erro ao carregar contas: {error?.message}</p>
                ) : (
                    <ConciliacaoManager contas={contas} />
                )}
            </div>
        </div>
    );
}
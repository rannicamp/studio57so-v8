// app/(main)/contratos/[id]/page.js

"use client";

import { useEffect } from 'react';
import { useParams, notFound, useRouter } from 'next/navigation';
import { createClient } from '../../../../utils/supabase/client';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext'; // 1. Importar para pegar a organização
import { useQuery } from '@tanstack/react-query'; // 2. Importar o useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faArrowLeft, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import FichaContrato from '../../../../components/contratos/FichaContrato';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A lógica de busca foi isolada para ser usada com `useQuery` e,
// mais importante, agora exige o `organizacaoId` para filtrar a busca.
// Isso impede que um usuário de uma organização acesse o contrato de outra.
// =================================================================================
const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    if (!contratoId || !organizacaoId) return null;

    const { data, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id (*, telefones(telefone, country_code), emails(email)),
            corretor:corretor_id (*), 
            produto:produto_id (*),
            empreendimento:empreendimento_id (
                nome,
                empresa:empresa_proprietaria_id (*)
            ),
            contrato_parcelas (*),
            contrato_permutas (*),
            simulacao:simulacao_id (*) 
        `)
        .eq('id', contratoId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA CRÍTICO!
        .maybeSingle();

    if (error) {
        throw new Error(`Falha ao carregar dados do contrato: ${error.message}`);
    }
    if (!data) {
        // Lança um erro específico para contrato não encontrado, que será pego pelo useQuery
        throw new Error('Contrato não encontrado ou você não tem permissão para visualizá-lo.');
    }
    
    // Ordena as parcelas antes de retornar
    if (data.contrato_parcelas) {
        data.contrato_parcelas.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
    }

    return data;
};

export default function ContratoPage() {
    const params = useParams();
    const supabase = createClient();
    const { user } = useAuth(); // Pegamos o usuário
    const organizacaoId = user?.organizacao_id; // E sua organização

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia estados de loading, error e cache de forma mais
    // eficiente e automática, simplificando o nosso componente.
    // =================================================================================
    const { data: contrato, isLoading: loading, isError, error, refetch } = useQuery({
        queryKey: ['contratoDetails', params.id, organizacaoId],
        queryFn: () => fetchContratoData(supabase, params.id, organizacaoId),
        enabled: !!params.id && !!organizacaoId, // Só executa se os IDs existirem
        retry: false, // Não tenta novamente se falhar (ex: contrato não encontrado)
    });

    // Se o useQuery retornar o erro de "não encontrado", exibimos a página 404.
    if (isError && error.message.includes('Contrato não encontrado')) {
        notFound();
    }

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                <p className="mt-2">Carregando dados do contrato...</p>
            </div>
        );
    }
    
    if (isError) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-600">Erro ao Carregar</h2>
                <p className="mt-2 text-red-700">{error.message}</p>
            </div>
        );
    }
    
    if (!contrato) return null; // Segurança extra caso os dados não carreguem

    return (
        <div className="space-y-6">
            <Link href="/contratos" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2 font-semibold">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Lista de Contratos
            </Link>
            
            <FichaContrato 
                initialContratoData={contrato} 
                onUpdate={refetch} // A função de update agora é o refetch do useQuery
            />
        </div>
    );
}
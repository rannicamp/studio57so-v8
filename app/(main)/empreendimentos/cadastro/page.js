// app/(main)/empreendimentos/cadastro/page.js
'use client';

import { createClient } from '../../../../utils/supabase/client';
import EmpreendimentoForm from '../../../../components/empreendimentos/EmpreendimentoForm';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const fetchFormData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { corporateEntities: [], proprietariaOptions: [] };

    const corporateEntitiesPromise = supabase.rpc('get_corporate_entities', { p_organizacao_id: organizacaoId });
    
    const proprietariaOptionsPromise = supabase
        .from('cadastro_empresa')
        .select('id, razao_social')
        .eq('organizacao_id', organizacaoId);

    // CORREÇÃO IMPORTANTE: Adicionado 'await' antes do Promise.all
    const [entitiesRes, proprietariaRes] = await Promise.all([
        corporateEntitiesPromise,
        proprietariaOptionsPromise
    ]);

    if (entitiesRes.error) throw new Error(`Erro ao buscar entidades: ${entitiesRes.error.message}`);
    if (proprietariaRes.error) throw new Error(`Erro ao buscar empresas: ${proprietariaRes.error.message}`);

    return {
        corporateEntities: entitiesRes.data || [],
        proprietariaOptions: proprietariaRes.data || []
    };
};

export default function CadastroEmpreendimentoPage() {
    // CORREÇÃO: createClient SEM await (Isso você já tinha feito, mantive correto)
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: formData, isLoading: loading, isError, error } = useQuery({
        queryKey: ['empreendimentoFormData', organizacaoId],
        queryFn: () => fetchFormData(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });
    
    const { corporateEntities, proprietariaOptions } = formData || { corporateEntities: [], proprietariaOptions: [] };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p className="mt-2">Carregando dados do formulário...</p>
            </div>
        );
    }

    if (isError) {
        return <p className="p-4 text-center text-red-500">Erro ao carregar dados: {error.message}</p>
    }

    return (
        <div className="space-y-6">
            <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empreendimentos
            </Link>
            <div className="bg-white rounded-lg shadow p-6">
                <EmpreendimentoForm
                    corporateEntities={corporateEntities}
                    proprietariaOptions={proprietariaOptions}
                />
            </div>
        </div>
    );
}
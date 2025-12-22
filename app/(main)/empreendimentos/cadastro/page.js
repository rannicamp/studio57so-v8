//app/(main)/empreendimentos/cadastro/page.js
'use client';

import { createClient } from '../../../../utils/supabase/client';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext'; // 1. Importar useAuth
import { useQuery } from '@tanstack/react-query'; // 2. Importar useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A busca foi isolada e agora exige o `organizacaoId` para filtrar
// as listas de opções do formulário, garantindo que o usuário só veja
// as empresas e entidades da sua própria organização.
// =================================================================================
const fetchFormData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { corporateEntities: [], proprietariaOptions: [] };

    // ATENÇÃO: A função 'get_corporate_entities' no banco PRECISA ser alterada para usar este parâmetro.
    const corporateEntitiesPromise = supabase.rpc('get_corporate_entities', { p_organizacao_id: organizacaoId });
    
    const proprietariaOptionsPromise = supabase
        .from('cadastro_empresa')
        .select('id, razao_social')
        .eq('organizacao_id', organizacaoId); // <-- FILTRO DE SEGURANÇA!

    const [entitiesRes, proprietariaRes] =  Promise.all([
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
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia o estado de carregamento, erros e cache de
    // forma mais eficiente e automática, simplificando o código.
    // =================================================================================
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
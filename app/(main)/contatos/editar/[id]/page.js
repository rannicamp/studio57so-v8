// app/(main)/contatos/editar/[id]/page.js
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../utils/supabase/client';
import ContatoForm from '../../../../../components/ContatoForm';
import { useLayout } from '../../../../../contexts/LayoutContext';
import { useAuth } from '../../../../../contexts/AuthContext'; // 1. Importar o useAuth
import { useQuery } from '@tanstack/react-query'; // 2. Importar o useQuery
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// =================================================================================
// ATUALIZAÇÃO DE PADRÃO E SEGURANÇA
// O PORQUÊ: A lógica de busca de dados foi isolada em uma função para ser usada
// com o `useQuery`. Mais importante, ela agora exige o `organizacaoId` e o aplica
// em TODAS as buscas (contato, telefones, emails), garantindo que um usuário
// só possa carregar dados da sua própria organização.
// =================================================================================
const fetchContactDetails = async (supabase, contatoId, organizacaoId) => {
    if (!contatoId || !organizacaoId) return null;

    // 1. Busca os dados principais do contato, agora com o filtro de segurança
    const { data: contatoData, error: contatoError } = await supabase
        .from('contatos')
        .select('*')
        .eq('id', contatoId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA CRÍTICO!
        .single();

    if (contatoError) {
        if (contatoError.code === 'PGRST116') {
            throw new Error('Contato não encontrado ou não pertence à sua organização.');
        }
        throw new Error(`Erro ao carregar o contato: ${contatoError.message}`);
    }

    // 2. Busca os telefones e emails, também com filtro de segurança
    const [telefonesRes, emailsRes] = await Promise.all([
        supabase.from('telefones').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId),
        supabase.from('emails').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId)
    ]);

    if (telefonesRes.error) console.warn("Erro ao buscar telefones:", telefonesRes.error.message);
    if (emailsRes.error) console.warn("Erro ao buscar emails:", emailsRes.error.message);

    // 3. Combina todos os dados
    return {
        ...contatoData,
        telefones: telefonesRes.data || [],
        emails: emailsRes.data || [],
    };
};

export default function EditarContatoPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const { id } = useParams();
    const supabase = createClient();
    const { user } = useAuth(); // Pegamos os dados do usuário
    const organizacaoId = user?.organizacao_id; // Extraímos o ID da organização

    // =================================================================================
    // ATUALIZAÇÃO DE PADRÃO (useState + useEffect -> useQuery)
    // O PORQUÊ: `useQuery` gerencia o estado de carregamento, erros e cache de forma
    // automática e mais eficiente, deixando o código mais limpo.
    // =================================================================================
    const { data: initialData, isLoading: loading, isError: hasError, error } = useQuery({
        queryKey: ['contactDetails', id, organizacaoId],
        queryFn: () => fetchContactDetails(supabase, id, organizacaoId),
        enabled: !!id && !!organizacaoId, // A busca só é ativada se tivermos o ID do contato e da organização
        retry: false, // Não tenta buscar novamente se o contato não for encontrado
    });
    
    useEffect(() => {
        setPageTitle('Editar Contato');
    }, [setPageTitle]);

    const handleSaveSuccess = () => {
        router.push('/contatos');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando Contato...</span>
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-600">Erro ao Carregar</h2>
                <p className="mt-2 text-red-700">{error.message}</p>
                <button 
                    onClick={() => router.push('/contatos')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                >
                    Voltar para Contatos
                </button>
            </div>
        );
    }

    return (
        <div>
            {initialData ? (
                <ContatoForm contactToEdit={initialData} onSaveSuccess={handleSaveSuccess} onClose={handleSaveSuccess} />
            ) : (
                <div className="text-center p-10 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h2 className="text-2xl font-bold text-yellow-600">Nenhum contato encontrado para editar.</h2>
                    <button 
                        onClick={() => router.push('/contatos')}
                        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700"
                    >
                        Voltar para Contatos
                    </button>
                </div>
            )}
        </div>
    );
}
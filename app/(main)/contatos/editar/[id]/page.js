// app/(main)/contatos/editar/[id]/page.js
"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../../../utils/supabase/client';
import ContatoForm from '../../../../../components/contatos/ContatoForm';
import { useLayout } from '../../../../../contexts/LayoutContext';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// Função isolada para buscar os dados com segurança
const fetchContactDetails = async (supabase, contatoId, organizacaoId) => {
    // Retorna null se não tiver os IDs necessários, evitando chamadas inválidas
    if (!contatoId || !organizacaoId) return null;

    // 1. Busca os dados principais do contato
    const { data: contatoData, error: contatoError } = await supabase
        .from('contatos')
        .select('*')
        .eq('id', contatoId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (contatoError) {
        // Ignora erro se for apenas "não encontrado" (trataremos na UI), mas lança outros erros
        if (contatoError.code === 'PGRST116') return null;
        throw new Error(`Erro ao carregar o contato: ${contatoError.message}`);
    }

    // 2. Busca telefones e emails em paralelo
    const [telefonesRes, emailsRes] = await Promise.all([
        supabase.from('telefones').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId),
        supabase.from('emails').select('*').eq('contato_id', contatoId).eq('organizacao_id', organizacaoId)
    ]);

    // 3. Combina tudo em um único objeto para o formulário
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
    
    // CORREÇÃO: createClient no cliente não pode ter 'await'
    const supabase = createClient();
    
    // Pegamos o usuário e também status de carregamento do Auth, se disponível
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Título da página
    useEffect(() => {
        if (setPageTitle) setPageTitle('Editar Contato');
    }, [setPageTitle]);

    // Busca de dados com TanStack Query
    const { data: initialData, isLoading, isError, error } = useQuery({
        queryKey: ['contactDetails', id, organizacaoId],
        queryFn: () => fetchContactDetails(supabase, id, organizacaoId),
        // Só busca quando tivermos o ID do contato E a organização carregada
        enabled: !!id && !!organizacaoId, 
        retry: false,
    });

    const handleSaveSuccess = () => {
        // Ao salvar, volta para a lista e o cache será invalidado lá
        router.push('/contatos');
    };

    // Loading State: Mostra carregando enquanto o Auth ou a Query estiverem trabalhando
    if (!organizacaoId || isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg">Carregando dados do contato...</span>
            </div>
        );
    }

    // Error State
    if (isError) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg m-4">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-600">Erro ao Carregar</h2>
                <p className="mt-2 text-red-700">{error?.message || "Erro desconhecido."}</p>
                <button 
                    onClick={() => router.push('/contatos')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 transition-colors"
                >
                    Voltar para Contatos
                </button>
            </div>
        );
    }

    // Empty State (Se não achou o contato ou ele não pertence à organização)
    if (!initialData) {
        return (
            <div className="text-center p-10 bg-yellow-50 border border-yellow-200 rounded-lg m-4">
                <h2 className="text-2xl font-bold text-yellow-600">Contato não encontrado.</h2>
                <p className="mt-2 text-gray-600">Este contato não existe ou você não tem permissão para editá-lo.</p>
                <button 
                    onClick={() => router.push('/contatos')}
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 transition-colors"
                >
                    Voltar para Contatos
                </button>
            </div>
        );
    }

    // Renderiza o formulário passando o ID da Organização explicitamente
    return (
        <div className="p-4">
            <ContatoForm 
                contactToEdit={initialData} 
                organizacaoId={organizacaoId} 
                onSaveSuccess={handleSaveSuccess} 
                onClose={handleSaveSuccess} 
            />
        </div>
    );
}
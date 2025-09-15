// app/(main)/funil/page.js
"use client";

import { useEffect } from 'react';
import FunilKanban from '@/components/crm/FunilKanban';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// =================================================================================
// ATUALIZAÇÃO DE BOAS PRÁTICAS (useQuery)
// O PORQUÊ: Isolamos a lógica de busca de dados em funções 'async' separadas.
// Isso torna o código mais limpo, reutilizável e é o padrão exigido pelo React Query.
// =================================================================================
const fetchFunilData = async (supabase, organizacaoId) => {
    if (!organizacaoId) throw new Error("Organização não identificada.");

    // Busca as colunas do funil (anteriormente 'crm_status')
    const { data: colunasData, error: colunasError } = await supabase
        .from('colunas_funil')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('ordem', { ascending: true });
    if (colunasError) throw colunasError;

    // Busca os contatos no funil e seus detalhes (anteriormente 'crm_contatos')
    // O PORQUÊ: Fazemos um 'join' para pegar os detalhes do contato e do responsável em uma única chamada.
    const { data: contatosData, error: contatosError } = await supabase
        .from('contatos_no_funil')
        .select(`
            *,
            coluna_id,
            contatos:contato_id (
                id, nome, telefones (telefone), emails (email)
            ),
            corretor:corretor_id (
                id, nome, sobrenome
            )
        `)
        .eq('organizacao_id', organizacaoId);
    if (contatosError) throw contatosError;

    return { colunas: colunasData || [], contatos: contatosData || [] };
};

export default function FunilPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Pegamos a "chave mestra" da organização aqui para blindar
    // todas as consultas de dados nesta página.
    // =================================================================================
    const organizacaoId = user?.organizacao_id;

    useEffect(() => {
        setPageTitle("Funil de Vendas");
    }, [setPageTitle]);

    // =================================================================================
    // ATUALIZAÇÃO DE PERFORMANCE (useQuery)
    // O PORQUÊ: Substituímos o 'useState' e 'useEffect' por 'useQuery'.
    // Ele gerencia automaticamente o carregamento, erros e o cache dos dados,
    // tornando o app mais rápido e o código mais simples.
    // =================================================================================
    const { data: funilData, isLoading, isError, error } = useQuery({
        queryKey: ['funil', organizacaoId],
        queryFn: () => fetchFunilData(supabase, organizacaoId),
        enabled: !!organizacaoId, // O 'useQuery' só será executado quando o organizacaoId estiver disponível.
    });

    // =================================================================================
    // ATUALIZAÇÃO DE UX (useMutation)
    // O PORQUÊ: Usamos 'useMutation' para qualquer ação que modifica dados.
    // Ele nos dá 'onSuccess' para invalidar o cache, fazendo com que a tela
    // se atualize automaticamente com os novos dados, sem precisar de um 'refetch' manual.
    // =================================================================================
    const { mutate: updateContatoStatus } = useMutation({
        mutationFn: async ({ contatoNoFunilId, newColunaId }) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");

            const { error } = await supabase
                .from('contatos_no_funil')
                .update({ coluna_id: newColunaId, updated_at: new Date().toISOString() })
                .eq('id', contatoNoFunilId)
                .eq('organizacao_id', organizacaoId); // <-- GARANTIA DE SEGURANÇA NA ESCRITA!
            
            if (error) throw error;
        },
        onSuccess: () => {
            // Invalida a query 'funil', forçando o React Query a buscar os dados mais recentes.
            queryClient.invalidateQueries({ queryKey: ['funil', organizacaoId] });
            toast.success("Card movido com sucesso!");
        },
        onError: (err) => {
            console.error('Erro ao atualizar status do contato:', err);
            toast.error(`Erro ao mover o card: ${err.message}`);
        }
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <span className="ml-4 text-lg">Carregando funil...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex justify-center items-center h-full text-red-600">
                <p>Erro ao carregar dados do funil: {error.message}</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full">
            <FunilKanban
                contatos={funilData?.contatos || []}
                statusColumns={funilData?.colunas || []}
                onStatusChange={updateContatoStatus}
            />
        </div>
    );
}
import { createClient } from '@/utils/supabase/server'; // <-- CORREÇÃO DEFINITIVA
import { redirect } from 'next/navigation';
import TreinamentoIA from '@/components/configuracoes/TreinamentoIA'; // <-- CORREÇÃO DEFINITIVA
import { Suspense } from 'react';

// Esta função busca os dados no servidor antes de mostrar a página
async function fetchDocumentosParaTreinamento() {
    const supabase = createClient();

    // Primeiro, verifica se o usuário está logado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/login');
    }

    // Busca todos os anexos e cruza com a tabela de "memória" da IA
    // para saber o status de cada um (Estudado ou Pendente).
    const { data, error } = await supabase.rpc('listar_documentos_para_treinamento');

    if (error) {
        console.error('Erro ao buscar documentos para treinamento:', error);
        return [];
    }
    
    return data;
}

// A página em si
export default async function PaginaTreinamentoIA() {
    const documentos = await fetchDocumentosParaTreinamento();

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-bold leading-6 text-gray-900">
                        Painel de Treinamento da IA - Stella
                    </h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Acompanhe aqui todos os documentos que a IA já estudou ou que estão na fila para aprendizado.
                    </p>
                </div>
            </div>
            <Suspense fallback={<p>Carregando documentos...</p>}>
                <TreinamentoIA initialDocumentos={documentos} />
            </Suspense>
        </div>
    );
}
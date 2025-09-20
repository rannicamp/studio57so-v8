// app/(main)/contratos/[id]/page.js

import { createClient } from '../../../../utils/supabase/server';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

// O PORQUÊ: Esta função será chamada toda vez que a página do contrato for acessada.
// Ela agora busca o contrato e TODOS os produtos associados a ele.
const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    // Busca o contrato principal e informações relacionadas
    const { data: contrato, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id (*),
            corretor:corretor_id (*),
            empreendimento:empreendimento_id (*),
            contrato_parcelas (*)
        `)
        .eq('id', contratoId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error) throw error;
    if (!contrato) return null;

    // NOVA LÓGICA: Busca a LISTA de produtos da nova tabela 'contrato_produtos'
    const { data: produtosDoContrato } = await supabase
        .from('contrato_produtos')
        .select(`
            produtos_empreendimento (*)
        `)
        .eq('contrato_id', contratoId);

    // Adiciona a lista de produtos ao objeto do contrato
    contrato.produtos = produtosDoContrato.map(item => item.produtos_empreendimento) || [];

    return contrato;
};

export default async function ContratoPage({ params }) {
    const supabase = createClient();
    const { id } = params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: userProfile } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();

    const organizacaoId = userProfile?.organizacao_id;
    if (!organizacaoId) {
        return <p className="p-4 text-red-500">Erro: Organização do usuário não encontrada.</p>;
    }

    try {
        const contratoData = await fetchContratoData(supabase, id, organizacaoId);
        if (!contratoData) notFound();

        const handleUpdate = async () => {
            'use server';
            // Esta função é passada para o cliente para que ele possa pedir
            // ao servidor para revalidar os dados quando algo mudar.
            // Por enquanto, a recarga da página pelo cliente já resolve.
        };

        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <Link href="/contratos" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Voltar para a Lista de Contratos
                </Link>
                <FichaContrato 
                    initialContratoData={contratoData} 
                    onUpdate={handleUpdate} // A função de atualização será gerenciada pelo React Query no cliente
                />
            </div>
        );
    } catch (error) {
        console.error("Erro ao carregar dados do contrato:", error);
        return <p className="p-4 text-red-500">Não foi possível carregar os dados do contrato. Verifique o console do servidor para mais detalhes.</p>;
    }
}
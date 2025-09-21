import { createClient } from '../../../../utils/supabase/server';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    
    // O PORQUÊ DA MUDANÇA:
    // A linha "empreendimento:..." foi ajustada para a sintaxe correta do Supabase.
    // Ela busca todos os dados do empreendimento (*) E também os dados da empresa
    // relacionada através da chave estrangeira (empresa:empresa_proprietaria_id(*)).
    const { data: contrato, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id (*),
            corretor:corretor_id (*),
            empreendimento:empreendimento_id(*, empresa:empresa_proprietaria_id(*)),
            contrato_parcelas (*),
            contrato_permutas (*)
        `)
        .eq('id', contratoId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error) {
        console.error('Erro detalhado do Supabase:', error); // Log mais detalhado do erro
        throw error;
    }
    if (!contrato) return null;

    const { data: produtosDoContrato } = await supabase
        .from('contrato_produtos')
        .select(`
            produtos_empreendimento (*)
        `)
        .eq('contrato_id', contratoId);

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

        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <div className="print:hidden">
                    <Link href="/contratos" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Voltar para a Lista de Contratos
                    </Link>
                </div>
                <FichaContrato 
                    initialContratoData={contratoData}
                />
            </div>
        );
    } catch (error) {
        return <p className="p-4 text-red-500">Não foi possível carregar os dados do contrato. Verifique o console do servidor para mais detalhes.</p>;
    }
}
// app/(main)/contratos/[id]/page.js

import { createClient } from '../../../../utils/supabase/server';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    
    // O PORQUÊ DA MUDANÇA (Explicado aqui fora, de forma segura):
    // Trocamos o "contato:contato_id(*)" por uma lista explícita de colunas.
    // Isso garante que todos os dados necessários sejam trazidos, mesmo que existam
    // regras de segurança específicas no banco de dados, tornando a busca mais robusta.
    const { data: contrato, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id (
                id,
                nome,
                razao_social,
                cpf,
                cnpj,
                rg,
                profissao,
                estado_civil,
                telefone,
                email,
                logradouro,
                numero,
                bairro,
                cidade,
                estado,
                cep,
                dados_conjuge,
                regime_bens,
                tipo_contato,
                responsavel_legal,
                cpf_responsavel_legal,
                rg_responsavel_legal,
                telefone_responsavel_legal,
                email_responsavel_legal
            ),
            corretor:corretor_id (*),
            empreendimento:empreendimento_id(*, empresa_proprietaria_id(*)),
            contrato_parcelas (*),
            contrato_permutas (*)
        `)
        .eq('id', contratoId)
        .eq('organizacao_id', organizacaoId)
        .single();

    if (error) {
        console.error('Erro detalhado do Supabase:', error);
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
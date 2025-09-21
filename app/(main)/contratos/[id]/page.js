// app/(main)/contratos/[id]/page.js

import { createClient } from '../../../../utils/supabase/server';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default async function ContratoPage({ params }) {
    
    const supabase = createClient();
    const { id } = params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    try {
        const { data: userProfile } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        const organizacaoId = userProfile?.organizacao_id;
        if (!organizacaoId) {
            throw new Error('Organização do usuário não encontrada.');
        }

        const { data: contratoData, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id (
                    id, nome, razao_social, cpf, cnpj, rg, cargo, estado_civil,
                    address_street, address_number, neighborhood, city, state, cep,
                    dados_conjuge, regime_bens, tipo_contato, responsavel_legal,
                    telefones(telefone),
                    emails(email)
                ),
                corretor:corretor_id (*),
                empreendimento:empreendimento_id(*, empresa_proprietaria_id(*)),
                contrato_parcelas (*),
                contrato_permutas (*)
            `)
            .eq('id', id)
            .eq('organizacao_id', organizacaoId)
            .order('created_at', { foreignTable: 'contato.telefones', ascending: false })
            .order('created_at', { foreignTable: 'contato.emails', ascending: false })
            .limit(1, { foreignTable: 'contato.telefones' })
            .limit(1, { foreignTable: 'contato.emails' })
            .single();

        if (error) throw error;
        if (!contratoData) notFound();

        // --- NOSSO TIRA-TEIMA ESTÁ AQUI ---
        // Esta linha vai imprimir os dados do contato no terminal do servidor.
        console.log('DADOS DO CONTATO RECEBIDOS DO SUPABASE: ', contratoData.contato);

        const { data: produtosDoContrato } = await supabase
            .from('contrato_produtos')
            .select('produtos_empreendimento (*)')
            .eq('contrato_id', id);

        contratoData.produtos = produtosDoContrato.map(item => item.produtos_empreendimento) || [];

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
        console.error("Erro detalhado ao buscar dados do contrato:", error);
        return <p className="p-4 text-red-500">Não foi possível carregar os dados do contrato. Verifique o console do servidor para mais detalhes.</p>;
    }
}
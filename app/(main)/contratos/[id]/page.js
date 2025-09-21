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

        // MUDANÇA AQUI: Adicionamos 'representante:representante_id(*, ...)'
        // O PORQUÊ: Agora a busca também traz os dados completos do contato
        // vinculado como representante, incluindo seus telefones e e-mails.
        const { data: contratoData, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id (
                    *,
                    telefones(telefone),
                    emails(email)
                ),
                conjuge:conjuge_id (
                    *,
                    telefones(telefone),
                    emails(email)
                ),
                representante:representante_id (
                    *,
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
            // Ordena e limita os contatos de todas as partes
            .order('created_at', { foreignTable: 'contato.telefones', ascending: false })
            .order('created_at', { foreignTable: 'contato.emails', ascending: false })
            .limit(1, { foreignTable: 'contato.telefones' })
            .limit(1, { foreignTable: 'contato.emails' })
            .order('created_at', { foreignTable: 'conjuge.telefones', ascending: false })
            .order('created_at', { foreignTable: 'conjuge.emails', ascending: false })
            .limit(1, { foreignTable: 'conjuge.telefones' })
            .limit(1, { foreignTable: 'conjuge.emails' })
            .order('created_at', { foreignTable: 'representante.telefones', ascending: false })
            .order('created_at', { foreignTable: 'representante.emails', ascending: false })
            .limit(1, { foreignTable: 'representante.telefones' })
            .limit(1, { foreignTable: 'representante.emails' })
            .single();

        if (error) throw error;
        if (!contratoData) notFound();

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
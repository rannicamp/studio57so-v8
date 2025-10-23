// app/(main)/contratos/[id]/page.js

import { createClient } from '../../../../utils/supabase/server';
import FichaContrato from '../../../../components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContratoPage({ params }) {

    const supabase = createClient();
    const { id } = params; // Acesso direto OK em Server Component Page

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

        // --- QUERY CORRIGIDA (REMOVIDOS COMENTÁRIOS INTERNOS) ---
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
                empreendimento:empreendimento_id(
                    *,
                    empresa_proprietaria_id(*)
                ),
                conta_financeira:conta_bancaria_id(*),
                contrato_parcelas (*),
                contrato_permutas (*)
            `)
            .eq('id', id)
            .eq('organizacao_id', organizacaoId)
            // Ordena e limita (mantido)
            .order('created_at', { foreignTable: 'contato.telefones', ascending: false })
            .limit(1, { foreignTable: 'contato.telefones' })
            .order('created_at', { foreignTable: 'contato.emails', ascending: false })
            .limit(1, { foreignTable: 'contato.emails' })
            // Adicione .order e .limit para conjuge/representante se precisar
            .single();
        // --- FIM DA QUERY CORRIGIDA ---

        if (error) {
             console.error("Erro na query principal do contrato:", error);
             // Melhorar mensagem de erro específica para falha de parse
             if (error.code === 'PGRST100') {
                 throw new Error(`Falha ao processar a busca no banco: ${error.message}. Verifique a sintaxe da query.`);
             }
             throw new Error(`Falha ao buscar contrato: ${error.message}`);
        }
        if (!contratoData) {
             console.warn(`Contrato com ID ${id} não encontrado para organização ${organizacaoId}.`);
             notFound(); // Mostra 404 se não achar
        }

        // Busca de produtos (mantido)
        const { data: produtosDoContrato, error: produtosError } = await supabase
            .from('contrato_produtos')
            .select('produtos_empreendimento (*)')
            .eq('contrato_id', id);

        if (produtosError) {
            console.error("Erro ao buscar produtos do contrato:", produtosError);
            contratoData.produtos = []; // Define como array vazio
        } else {
            contratoData.produtos = produtosDoContrato?.map(item => item.produtos_empreendimento) || [];
        }


        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <div className="print:hidden">
                    <Link href="/contratos" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Voltar para a Lista de Contratos
                    </Link>
                </div>
                {/* Passa os dados buscados */}
                <FichaContrato
                    initialContratoData={contratoData}
                />
            </div>
        );

    } catch (error) {
        console.error("Erro geral na página do contrato:", error);
        return <p className="p-4 text-red-500">Não foi possível carregar os dados do contrato. Causa: {error.message}</p>;
    }
}
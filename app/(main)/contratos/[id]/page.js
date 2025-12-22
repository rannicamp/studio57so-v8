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

    const supabase = await createClient();
    const { id } = params; 

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    try {
        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();
        
        if (profileError || !userProfile?.organizacao_id) {
             console.error("Erro ao buscar perfil do usuário ou organização não encontrada:", profileError);
             throw new Error('Perfil do usuário ou Organização não encontrada.');
        }

        const organizacaoId = userProfile.organizacao_id;

        const { data: contratoData, error } = await supabase
            .from('contratos')
            .select(`
                *,
                contato:contato_id ( *, telefones(telefone), emails(email) ),
                conjuge:conjuge_id ( *, telefones(telefone), emails(email) ),
                representante:representante_id ( *, telefones(telefone), emails(email) ),
                corretor:corretor_id (*),
                empreendimento:empreendimento_id( *, empresa_proprietaria_id(*) ),
                conta_financeira:conta_bancaria_id(*),
                contrato_parcelas (*),
                contrato_permutas (*)
            `)
            .eq('id', id)
            .eq('organizacao_id', organizacaoId)
            .order('created_at', { foreignTable: 'contato.telefones', ascending: false })
            .limit(1, { foreignTable: 'contato.telefones' })
            .order('created_at', { foreignTable: 'contato.emails', ascending: false })
            .limit(1, { foreignTable: 'contato.emails' })
            .single();

        if (error) {
             console.error("Erro na query principal do contrato:", error);
             if (error.code === 'PGRST100') {
                 throw new Error(`Falha ao processar a busca no banco: ${error.message}.`);
             }
             throw new Error(`Falha ao buscar contrato: ${error.message}`);
        }
        if (!contratoData) {
             console.warn(`Contrato com ID ${id} não encontrado para organização ${organizacaoId}.`);
             notFound(); 
        }

        const { data: produtosDoContrato, error: produtosError } = await supabase
            .from('contrato_produtos')
            .select('produtos_empreendimento (*)')
            .eq('contrato_id', id);

        if (produtosError) {
            console.error("Erro ao buscar produtos do contrato:", produtosError);
            contratoData.produtos = [];
        } else {
            contratoData.produtos = produtosDoContrato?.map(item => item.produtos_empreendimento) || [];
        }

        const combinedUser = {
            id: user.id,
            organizacao_id: organizacaoId
        };

        return (
            // REMOVIDO: max-w-7xl mx-auto
            // Mantido apenas o padding e background para ocupar a tela toda
            <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8 space-y-6">
                <div className="print:hidden">
                    <Link href="/contratos" className="text-gray-500 hover:text-blue-600 mb-4 inline-flex items-center gap-2 transition-colors font-medium text-sm">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Voltar para a Lista de Contratos
                    </Link>
                </div>
                
                <FichaContrato
                    initialContratoData={contratoData}
                    user={combinedUser}
                    clientSearchScope="organization"
                />
            </div>
        );

    } catch (error) {
        console.error("Erro geral na página do contrato:", error);
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Erro ao carregar contrato</h2>
                    <p className="text-gray-600 mb-4">{error.message}</p>
                    <Link href="/contratos" className="text-blue-600 hover:underline">
                        Voltar para a lista
                    </Link>
                </div>
            </div>
        );
    }
}
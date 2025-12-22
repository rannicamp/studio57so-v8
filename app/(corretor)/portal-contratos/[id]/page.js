// app/(corretor)/portal-contratos/[id]/page.js

import { createClient } from '@/utils/supabase/server';
import FichaContrato from '@/components/contratos/FichaContrato';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContratoPageCorretor({ params }) {

    const supabase = await createClient();
    const { id } = params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    try {
        // 1. Buscamos o perfil para pegar o organizacao_id
        const { data: userProfile, error: profileError } = await supabase
            .from('usuarios')
            .select('organizacao_id')
            .eq('id', user.id)
            .single();

        // Tratamento de erro caso não ache o perfil
        if (profileError || !userProfile?.organizacao_id) {
             console.error("Erro ao buscar perfil do usuário ou organização não encontrada:", profileError);
             // Você pode redirecionar ou mostrar uma mensagem de erro mais específica
             throw new Error('Perfil do usuário ou Organização não encontrada.');
        }

        const organizacaoId = userProfile.organizacao_id; // <-- Temos o ID aqui

        // Query principal do contrato (com filtro de segurança)
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
            .eq('criado_por_usuario_id', user.id) 
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
             console.warn(`Tentativa de acesso negada ou contrato não encontrado. ID: ${id}, Usuário: ${user.id}`);
             notFound();
        }

        // Busca de produtos (mantido)
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

        // --- 2. A CORREÇÃO: Criar o objeto 'user' combinado ---
        const combinedUser = {
            id: user.id, // ID do usuário autenticado
            organizacao_id: organizacaoId // ID da organização vindo do perfil
            // Adicione outros campos do user (como email) se FichaContrato precisar
        };
        // --- FIM DA CORREÇÃO ---

        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <div className="print:hidden">
                    <Link href="/portal-contratos" className="text-blue-600 hover:underline mb-4 inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Voltar para Meus Contratos
                    </Link>
                </div>
                
                {/* 3. Passamos o objeto 'combinedUser' */}
                <FichaContrato
                    initialContratoData={contratoData}
                    user={combinedUser} 
                    clientSearchScope="user" 
                />
            </div>
        );

    } catch (error) {
        console.error("Erro geral na página do contrato:", error);
        // Garante que o usuário veja uma mensagem de erro clara
        return <p className="p-4 text-red-500">Não foi possível carregar os dados do contrato. Causa: {error.message}</p>;
    }
}
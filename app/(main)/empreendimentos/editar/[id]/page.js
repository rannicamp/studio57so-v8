//app/(main)/empreendimentos/editar/[id]/page.js
import { createClient } from '../../../../../utils/supabase/server';
import EmpreendimentoForm from '@/components/empreendimentos/EmpreendimentoForm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditarEmpreendimentoPage({ params }) {
    const { id } = params;
    const supabase = await createClient();

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Primeiro, identificamos o usuário e sua organização para usar como
    // chave de segurança em todas as buscas de dados.
    // =================================================================================
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }
    const { data: userProfile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
    const organizacaoId = userProfile?.organizacao_id;

    if (!organizacaoId) {
        return <p className="p-4 text-red-500">Erro: Organização do usuário não encontrada.</p>;
    }

    // Busca o empreendimento a ser editado, validando o ID e a ORGANIZAÇÃO
    const { data: empreendimento, error: empreendimentoError } = await supabase
        .from('empreendimentos')
        .select('*')
        .eq('id', id)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA CRÍTICO!
        .single();

    if (empreendimentoError || !empreendimento) {
        notFound();
    }

    // Busca os dados de apoio, AGORA COM FILTRO DE SEGURANÇA
    // ATENÇÃO: A função 'get_corporate_entities' no banco PRECISA ser alterada para usar este parâmetro.
    const { data: corporateEntities } = await supabase.rpc('get_corporate_entities', { p_organizacao_id: organizacaoId });
    const { data: proprietariaOptions } = await supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacaoId);

    return (
        <div className="space-y-6">
            <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empreendimentos
            </Link>
            <div className="bg-white rounded-lg shadow p-6">
                <EmpreendimentoForm
                    empreendimento={empreendimento}
                    corporateEntities={corporateEntities || []}
                    proprietariaOptions={proprietariaOptions || []}
                />
            </div>
        </div>
    );
}
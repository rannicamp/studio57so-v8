//app/(main)/empresas/editar/[id]/page.js
import { createClient } from '../../../../../utils/supabase/server';
import EmpresaForm from '../../../../../components/empresas/EmpresaForm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export default async function EditarEmpresaPage({ params }) {
    const supabase = await createClient();
    const { id } = params;

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

    // Busca os dados da empresa, AGORA COM DUPLA VALIDAÇÃO DE SEGURANÇA
    const { data: empresa, error } = await supabase
        .from('cadastro_empresa')
        .select('*')
        .eq('id', id)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA CRÍTICO!
        .single();

    if (error || !empresa) {
        console.error("Empresa não encontrada ou não pertence à organização:", error);
        notFound();
    }

    return (
        <div className="space-y-6">
             <Link href="/empresas" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empresas
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Editar Empresa</h1>
            <div className="bg-white rounded-lg shadow p-6">
                {/* Passa os dados seguros da empresa para o formulário */}
                <EmpresaForm initialData={empresa} />
            </div>
        </div>
    );
}
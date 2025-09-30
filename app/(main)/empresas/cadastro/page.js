//app/(main)/empresas/cadastro/page.js
import { createClient } from '../../../../utils/supabase/server';
import EmpresaForm from '../../../../components/empresas/EmpresaForm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function CadastroEmpresaPage() {
    const supabase = createClient();

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

    // Busca a lista de empresas, AGORA COM FILTRO DE SEGURANÇA
    const { data: companies } = await supabase
        .from('cadastro_empresa')
        .select('id, razao_social')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('razao_social', { ascending: true });

    // Busca a lista de empreendimentos, AGORA COM FILTRO DE SEGURANÇA
    const { data: empreendimentos } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('nome', { ascending: true });

    return (
        <div className="space-y-6">
            <Link href="/empresas" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Empresas
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Cadastro de Nova Empresa</h1>
            
            <div className="bg-white rounded-lg shadow p-6">
                <EmpresaForm companies={companies || []} empreendimentos={empreendimentos || []} />
            </div>
        </div>
    );
}
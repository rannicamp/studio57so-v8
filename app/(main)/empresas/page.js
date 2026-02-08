// app/(main)/empresas/page.js
import { createClient } from '../../../utils/supabase/server';
import Link from 'next/link';
import EmpresaList from '../../../components/empresas/EmpresaList';
import { redirect } from 'next/navigation';

export default async function GerenciamentoEmpresasPage() {
    // CORREÇÃO CRUCIAL: Adicionado 'await' aqui para Next.js 15
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    const { data: userProfile } = await supabase
        .from('usuarios')
        .select('organizacao_id, funcao:funcoes ( nome_funcao )')
        .eq('id', user.id)
        .single();
    
    const organizacaoId = userProfile?.organizacao_id;
    const userRole = userProfile?.funcao?.nome_funcao;

    // Apenas 'Proprietário' e 'Administrador' podem ver esta página
    if (!['Proprietário', 'Administrador'].includes(userRole)) {
        redirect('/');
    }
    
    if (!organizacaoId) {
        return <p className="p-4 text-red-500">Erro: Organização do usuário não encontrada.</p>;
    }

    const { data: companies, error } = await supabase
        .from('cadastro_empresa')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('razao_social');

    if (error) {
        console.error('Erro ao buscar empresas:', error.message);
        return <p className="p-4 text-red-500">Não foi possível carregar as empresas.</p>;
    }

    const canDelete = (userRole === 'Proprietário');

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empresas</h1>
                <Link href="/empresas/cadastro" className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700">
                    + Nova Empresa
                </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow">
                <EmpresaList initialEmpresas={companies || []} isAdmin={canDelete} />
            </div>
        </div>
    );
}
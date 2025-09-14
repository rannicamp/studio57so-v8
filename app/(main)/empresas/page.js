//app/(main)/empresas/page.js
import { createClient } from '../../../utils/supabase/server';
import Link from 'next/link';
import EmpresaList from '../../../components/EmpresaList';
import { redirect } from 'next/navigation';

export default async function GerenciamentoEmpresasPage() {
    const supabase = createClient();

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id) E PERMISSÕES
    // O PORQUÊ: Buscamos o perfil completo do usuário para obter sua organização e sua
    // função, garantindo tanto a segurança dos dados quanto o controle de acesso à página.
    // =================================================================================
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

    // Apenas 'Proprietário' pode ver esta página (ajuste a regra se necessário)
    if (userRole !== 'Proprietário') {
        redirect('/');
    }
    
    if (!organizacaoId) {
        return <p className="p-4 text-red-500">Erro: Organização do usuário não encontrada.</p>;
    }

    // Busca as empresas, AGORA COM FILTRO DE SEGURANÇA
    const { data: companies, error } = await supabase
        .from('cadastro_empresa')
        .select('*')
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('razao_social');

    if (error) {
        console.error('Erro ao buscar empresas:', error.message);
        return <p className="p-4 text-red-500">Não foi possível carregar as empresas.</p>;
    }

    // A permissão de admin/exclusão agora é baseada na função
    const canDelete = (userRole === 'Proprietário');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empresas</h1>
                <Link href="/empresas/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                    + Nova Empresa
                </Link>
            </div>
            
            <div className="bg-white rounded-lg shadow">
                <EmpresaList initialEmpresas={companies || []} canDelete={canDelete} />
            </div>
        </div>
    );
}
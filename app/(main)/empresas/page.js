import { createClient } from '../../../utils/supabase/server';
import Link from 'next/link';
import EmpresaList from '../../../components/EmpresaList';

export default async function GerenciamentoEmpresasPage() {
  const supabase = createClient();

  // Busca todas as empresas
  const { data: companies, error } = await supabase
    .from('cadastro_empresa')
    .select('*')
    .order('razao_social');

  if (error) {
    console.error('Erro ao buscar empresas:', error.message);
    return <p className="p-4 text-red-500">Não foi possível carregar as empresas.</p>;
  }

  // Verifica se o usuário é admin para passar a permissão de exclusão
  let isAdmin = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: userData } = await supabase.from('usuarios').select('is_admin').eq('id', user.id).single();
    isAdmin = userData?.is_admin || false;
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empresas</h1>
        <Link href="/empresas/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Nova Empresa
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <EmpresaList initialEmpresas={companies || []} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
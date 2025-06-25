import { createClient } from '../../../../utils/supabase/server';
import PermissionManager from '../../../../components/PermissionManager';
import { redirect } from 'next/navigation';

export default async function PermissoesPage() {
  const supabase = createClient();

  // 1. Verifica se o usuário é administrador para acessar esta página
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: adminData } = await supabase
    .from('usuarios')
    .select('funcao_id, funcoes(nome_funcao)')
    .eq('id', user.id)
    .single();

  // Apenas 'Proprietário' pode ver esta página
  if (adminData?.funcoes?.nome_funcao !== 'Proprietário') {
    redirect('/');
  }

  // 2. Busca todas as funções e suas permissões atuais do banco de dados
  const { data: funcoes, error: funcoesError } = await supabase
    .from('funcoes')
    .select(`
      *,
      permissoes(*)
    `)
    .order('id');

  if (funcoesError) {
    console.error("Erro ao buscar funções e permissões:", funcoesError);
    return <p className="p-4 text-red-500">Erro ao carregar os dados de permissão.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Permissões</h1>
      <p className="text-gray-600">
        Marque as caixas para definir o que cada função de usuário pode ver, criar, editar ou excluir no sistema.
      </p>
      
      <div className="bg-white rounded-lg shadow p-6">
        <PermissionManager initialFuncoes={funcoes || []} />
      </div>
    </div>
  );
}
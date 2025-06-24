import { createClient } from '@/utils/supabase/server';
import UserManagementForm from '@/components/UserManagementForm';
import Link from 'next/link';
import { redirect } from 'next/navigation'; // Importa o redirecionamento

export default async function UserManagementPage() {
  const supabase = createClient();

  // 1. Verifica se o usuário está logado
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Se não houver usuário logado, redireciona para a página de login
    redirect('/login');
  }

  // 2. Busca os dados do usuário na sua tabela 'usuarios' para verificar is_admin
  const { data: userData, error: userProfileError } = await supabase
    .from('usuarios')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  // Se houver erro ao buscar o perfil do usuário ou ele não for admin, redireciona
  if (userProfileError || !userData || !userData.is_admin) {
    console.error('Acesso negado: Usuário não é administrador ou perfil não encontrado.', userProfileError);
    // Redireciona para o dashboard ou uma página de acesso negado
    redirect('/'); 
  }

  // Se for admin, continua e busca os dados para a gestão de usuários
  const { data: users, error: usersError } = await supabase
    .from('usuarios')
    .select(`
      *,
      funcionario:funcionarios (id, full_name, cpf)
    `)
    .order('nome', { ascending: true });

  const { data: employees, error: employeesError } = await supabase
    .from('funcionarios')
    .select('id, full_name, cpf')
    .order('full_name', { ascending: true });

  if (usersError) {
    console.error('Erro ao buscar usuários:', usersError);
    return <p className="text-red-500 p-4">Erro ao carregar usuários: {usersError.message}</p>;
  }
  if (employeesError) {
    console.error('Erro ao buscar funcionários:', employeesError);
    // Se a lista de funcionários falhar, pode ser um aviso, não necessariamente um erro fatal
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
        <Link href="/" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md shadow-sm hover:bg-gray-300">
          &larr; Voltar ao Dashboard
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <UserManagementForm 
          initialUsers={users || []} 
          allEmployees={employees || []} 
        />
      </div>
    </div>
  );
}
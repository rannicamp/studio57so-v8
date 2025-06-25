import { createClient } from '@/utils/supabase/server';
import UserManagementForm from '@/components/UserManagementForm';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function UserManagementPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData, error: userProfileError } = await supabase
    .from('usuarios')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (userProfileError || !userData || !userData.is_admin) {
    console.error('Acesso negado: Usuário não é administrador ou perfil não encontrado.', userProfileError);
    redirect('/'); 
  }

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
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
        {/* O BOTÃO FOI REMOVIDO DESTA ÁREA */}
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
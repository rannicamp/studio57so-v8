import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import UserManagementForm from '@/components/UserManagementForm'; // Caminho e nome do componente corrigido

// Função para buscar todos os usuários
async function getUsers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nome,
      sobrenome,
      email,
      is_active,
      funcao:funcoes ( id, nome_funcao ),
      funcionario:funcionarios ( id, full_name, cpf )
    `);
  if (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
  return data;
}

// Função para buscar todos os funcionários (para o dropdown)
async function getEmployees() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('funcionarios')
        .select('id, full_name, cpf')
        .order('full_name', { ascending: true });
    if (error) {
        console.error('Erro ao buscar funcionários:', error);
        return [];
    }
    return data;
}

// Função para buscar todas as funções (para o dropdown)
async function getRoles() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('funcoes')
    .select('id, nome_funcao')
    .order('nome_funcao', { ascending: true });
  if (error) {
    console.error('Erro ao buscar funções:', error);
    return [];
  }
  return data;
}

export default async function UserManagementPage() {
  const supabase = createClient();

  // Protege a rota usando o sistema de Funções
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: userProfile, error: userProfileError } = await supabase
    .from('usuarios')
    .select('funcao:funcoes ( nome_funcao )')
    .eq('id', user.id)
    .single();

  if (userProfileError || userProfile?.funcao?.nome_funcao !== 'Proprietário') {
    redirect('/'); 
  }

  // Busca todos os dados necessários para a página
  const [users, employees, roles] = await Promise.all([getUsers(), getEmployees(), getRoles()]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
      <p className="text-gray-600 mt-1">Gerencie os usuários e suas permissões no sistema.</p>
      
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <UserManagementForm 
            initialUsers={users} 
            allEmployees={employees} 
            allRoles={roles}
        />
      </div>
    </div>
  );
}
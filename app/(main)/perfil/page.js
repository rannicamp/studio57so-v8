import ProfileForm from '../../../components/ProfileForm'; // Usaremos um novo componente de formulário
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function PerfilPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Busca os dados atuais do usuário para preencher o formulário
  const { data: userData, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("Erro ao buscar dados do usuário para o perfil:", error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
      <p className="text-gray-600">Atualize suas informações pessoais e sua foto de perfil.</p>
      
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <ProfileForm userData={userData} />
      </div>
    </div>
  );
}
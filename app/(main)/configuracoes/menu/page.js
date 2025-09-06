import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import MenuSettingsForm from '../../../../components/MenuSettingsForm';

export default async function MenuSettingsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Busca o usuário e sua preferência atual de sidebar
  const { data: userData, error } = await supabase
    .from('usuarios')
    .select('id, sidebar_position')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("Erro ao buscar dados do usuário:", error);
    // Lidar com o erro, talvez redirecionar ou mostrar uma mensagem
    return <div>Erro ao carregar suas configurações.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configurações do Menu</h1>
        <p className="mt-2 text-gray-600">
          Escolha onde o menu principal (sidebar) deve ser exibido na tela. A alteração será aplicada na próxima vez que você recarregar a página.
        </p>
      </div>

      <MenuSettingsForm
        userId={userData.id}
        currentPosition={userData.sidebar_position || 'left'}
      />
    </div>
  );
}
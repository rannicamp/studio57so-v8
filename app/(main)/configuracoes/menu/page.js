//app\(main)\configuracoes\menu\page.js
import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import MenuSettingsForm from '../../../../components/MenuSettingsForm';

// Função para verificar a permissão e já buscar os dados do usuário
async function checkPermissionsAndGetData() {
  const supabase = createClient();
  
  // 1. Verifica se há um usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Busca o perfil do usuário para obter todos os dados necessários de uma vez
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('id, funcao_id, sidebar_position, funcoes ( nome_funcao )')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error("Erro ao buscar dados do usuário:", userError);
    redirect('/');
  }
  
  // A função 'Proprietário' sempre tem acesso
  if (userData?.funcoes?.nome_funcao === 'Proprietário') {
    return userData; // Retorna os dados do usuário se for Proprietário
  }

  // 3. Para as outras funções, verifica a permissão específica
  const { data: permissionData, error: permissionError } = await supabase
    .from('permissoes')
    .select('pode_ver')
    .eq('funcao_id', userData.funcao_id)
    .eq('recurso', 'config_menu') // <--- Chave de permissão para esta página
    .single();

  if (permissionError || !permissionData?.pode_ver) {
    redirect('/'); // Redireciona se não tiver a permissão
  }

  return userData; // Retorna os dados do usuário se a permissão for válida
}


export default async function MenuSettingsPage() {
  // Executa a verificação e já recebe os dados do usuário validados
  const userData = await checkPermissionsAndGetData();

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
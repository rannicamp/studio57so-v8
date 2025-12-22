// app/(corretor)/portal-perfil/page.js

// Importamos o MESMO formulário de perfil que o sistema principal usa
import ProfileForm from '@/components/ProfileForm'; // Ajustado o caminho relativo
import { createClient } from '@/utils/supabase/server'; // Ajustado o caminho relativo
import { redirect } from 'next/navigation';

export default async function PortalPerfilPage() { // Renomeado para clareza
  const supabase = await createClient();

  // 1. Busca o usuário autenticado (igual à página /perfil original)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Se não estiver logado (improvável dentro deste layout), redireciona para login
    redirect('/login'); 
  }

  // 2. Busca os dados atuais do usuário da tabela 'usuarios'
  //    Esta parte é crucial para pré-preencher o formulário.
  const { data: userData, error } = await supabase
    .from('usuarios')
    .select('*') // Pega todas as colunas (nome, sobrenome, avatar_url, etc.)
    .eq('id', user.id) // Filtra pelo ID do usuário logado
    .single(); // Espera apenas um resultado

  if (error && error.code !== 'PGRST116') { // Ignora erro se 'single' não encontrar nada
    // Se ocorrer um erro (diferente de não encontrar o usuário), registra no console
    console.error("Erro ao buscar dados do usuário para o portal-perfil:", error);
    // Poderíamos mostrar uma mensagem de erro na tela aqui, se desejado
  }

  // 3. Renderiza a página
  return (
    <div className="space-y-6">
      {/* Título da página */}
      <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
      <p className="text-gray-600">Atualize suas informações pessoais e sua foto de perfil.</p>
      
      {/* Container do formulário */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        {/* Renderiza o componente ProfileForm, passando os dados do usuário */}
        {/* Se userData for null (usuário não encontrado em 'usuarios'), o ProfileForm deve lidar com isso */}
        <ProfileForm userData={userData} /> 
      </div>
    </div>
  );
}
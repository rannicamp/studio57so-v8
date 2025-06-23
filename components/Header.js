import LogoutButton from './LogoutButton';
import { createClient } from '../utils/supabase/server';

const Header = async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userName = user?.email; // Define o e-mail como um valor padrão

  if (user) {
    // Agora, busca o perfil do usuário na nossa tabela 'usuarios'
    const { data: profile } = await supabase
      .from('usuarios')
      .select('nome, sobrenome')
      .eq('id', user.id)
      .single(); // .single() é usado para pegar apenas um resultado como objeto

    // Se encontrou um perfil com nome ou sobrenome, usa eles
    if (profile && (profile.nome || profile.sobrenome)) {
      // Junta o nome e o sobrenome, removendo espaços extras se um deles não existir
      userName = [profile.nome, profile.sobrenome].filter(Boolean).join(' ');
    }
  }

  return (
    <header className="bg-white shadow-md h-[65px] fixed top-0 w-full z-10 flex items-center justify-end px-6">
      <div>
        {user ? (
          <div className="flex items-center">
            {/* Agora exibe a variável userName, que pode ser o nome completo ou o e-mail */}
            <span className="text-sm font-medium text-gray-700">{userName}</span>
            <LogoutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;
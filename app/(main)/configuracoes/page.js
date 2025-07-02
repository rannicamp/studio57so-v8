import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCog, faShieldAlt, faBoxOpen, faClock } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

const SettingsCard = ({ href, icon, title, description }) => (
  <Link href={href}>
    <div className="bg-gray-50 p-6 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-100 transition-all cursor-pointer">
      <FontAwesomeIcon icon={icon} className="text-3xl text-blue-500 mb-3" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  </Link>
);

export default async function ConfiguracoesPage() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: userData } = await supabase
            .from('usuarios')
            .select('funcao:funcoes ( nome_funcao )')
            .eq('id', user.id)
            .single();

        if (userData?.funcao?.nome_funcao !== 'Proprietário') {
            redirect('/');
        }
    } else {
        redirect('/login');
    }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-600 mt-1">Gerencie as configurações e permissões para todo o sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SettingsCard 
          href="/configuracoes/usuarios"
          icon={faUserCog}
          title="Gestão de Usuários"
          description="Ative, desative e atribua funções para os usuários do sistema."
        />
        <SettingsCard 
          href="/configuracoes/permissoes"
          icon={faShieldAlt}
          title="Gerenciar Permissões"
          description="Defina o que cada função pode ver, criar, editar ou excluir."
        />
        <SettingsCard 
          href="/configuracoes/materiais"
          icon={faBoxOpen}
          title="Gestão de Materiais"
          description="Importe, exporte e gerencie a sua base de materiais."
        />
        {/* NOVO CARD ADICIONADO AQUI */}
        <SettingsCard 
          href="/configuracoes/jornadas"
          icon={faClock}
          title="Jornadas de Trabalho"
          description="Crie e gerencie os horários e cargas horárias dos funcionários."
        />
      </div>
    </div>
  );
}
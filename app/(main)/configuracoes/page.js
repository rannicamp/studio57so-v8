import Link from 'next/link';
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsersCog, faKey, faFileAlt, faBusinessTime, faBox, faNetworkWired
} from '@fortawesome/free-solid-svg-icons';

// Opções de configuração que aparecerão na página
const settingsOptions = [
  {
    href: '/configuracoes/usuarios',
    icon: faUsersCog,
    title: 'Gestão de Usuários',
    description: 'Adicione, remova e gerencie os usuários do sistema e suas funções.'
  },
  {
    href: '/configuracoes/permissoes',
    icon: faKey,
    title: 'Permissões de Acesso',
    description: 'Defina o que cada função de usuário pode ver e fazer no sistema.'
  },
  {
    href: '/configuracoes/jornadas',
    icon: faBusinessTime,
    title: 'Jornadas de Trabalho',
    description: 'Crie e edite os horários de trabalho padrão para o controle de ponto.'
  },
  {
    href: '/configuracoes/tipos-documento',
    icon: faFileAlt,
    title: 'Tipos de Documento',
    description: 'Gerencie as siglas e descrições dos tipos de documentos para uploads.'
  },
  {
    href: '/configuracoes/integracoes',
    icon: faNetworkWired,
    title: 'Integrações',
    description: 'Configure as chaves e credenciais de APIs externas, como a do WhatsApp.'
  },
  {
    href: '/configuracoes/materiais',
    icon: faBox,
    title: 'Base de Materiais',
    description: 'Gerencie a base de dados central de materiais e serviços para orçamentos.'
  },
];

export default async function ConfiguracoesPage() {
  const supabase = createClient();

  // Proteção de Rota: Apenas o "Proprietário" pode acessar
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: adminData } = await supabase
    .from('usuarios')
    .select('funcoes(nome_funcao)')
    .eq('id', user.id)
    .single();

  if (adminData?.funcoes?.nome_funcao !== 'Proprietário') {
    redirect('/');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações Gerais</h1>
        <p className="mt-2 text-gray-600">
          Gerencie as configurações centrais que afetam todo o sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsOptions.map((option) => (
          <Link href={option.href} key={option.href} className="block group">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full">
              <FontAwesomeIcon icon={option.icon} className="text-3xl text-blue-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">{option.title}</h2>
              <p className="text-sm text-gray-600">{option.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
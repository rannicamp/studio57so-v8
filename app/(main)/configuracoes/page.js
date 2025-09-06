import Link from 'next/link';
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsersCog, faKey, faFileAlt, faBusinessTime, faBox, faNetworkWired, faRobot, faInbox, faFileContract, faColumns
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
  {
    href: '/configuracoes/treinamento-ia',
    icon: faRobot,
    title: 'Treinamento da IA',
    description: 'Acompanhe o que a IA Stella já aprendeu e gerencie seu conhecimento.'
  },
  {
    href: '/configuracoes/feedback',
    icon: faInbox,
    title: 'Central de Feedback',
    description: 'Envie sugestões ou visualize os feedbacks recebidos dos usuários.'
  },
  {
    href: '/configuracoes/politicas',
    icon: faFileContract,
    title: 'Políticas de Uso',
    description: 'Leia os Termos de Uso e a Política de Privacidade do sistema.'
  },
  // --- NOVO CARTÃO ADICIONADO AQUI ---
  {
    href: '/configuracoes/menu',
    icon: faColumns,
    title: 'Configurações do Menu',
    description: 'Personalize a posição do menu lateral (sidebar) na tela.'
  },
];

export default async function ConfiguracoesPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcoes(nome_funcao)')
    .eq('id', user.id)
    .single();

  const isOwner = userData?.funcoes?.nome_funcao === 'Proprietário';

  // Filtra as opções baseadas na permissão
  const availableOptions = settingsOptions.filter(option => {
    // Todos podem ver as políticas e configurar o menu
    if (['/configuracoes/politicas', '/configuracoes/menu', '/configuracoes/feedback'].includes(option.href)) {
      return true;
    }
    // Apenas o proprietário pode ver o resto
    return isOwner;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="mt-2 text-gray-600">
          Gerencie as configurações do sistema ou personalize sua experiência.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableOptions.map((option) => (
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
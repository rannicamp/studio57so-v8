import Link from 'next/link';
import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsersCog, faKey, faFileAlt, faBusinessTime, faBox, faNetworkWired, faRobot, faInbox, faFileContract, faColumns
} from '@fortawesome/free-solid-svg-icons';
import { checkPermission } from '../../../utils/permissions'; // Importamos nossa "guardiã"

// Opções de configuração que aparecerão na página
const settingsOptions = [
  {
    key: 'usuarios',
    href: '/configuracoes/usuarios',
    icon: faUsersCog,
    title: 'Gestão de Usuários',
    description: 'Adicione, remova e gerencie os usuários do sistema e suas funções.'
  },
  {
    key: 'permissoes',
    href: '/configuracoes/permissoes',
    icon: faKey,
    title: 'Permissões de Acesso',
    description: 'Defina o que cada função de usuário pode ver e fazer no sistema.'
  },
  {
    key: 'jornadas',
    href: '/configuracoes/jornadas',
    icon: faBusinessTime,
    title: 'Jornadas de Trabalho',
    description: 'Crie e edite os horários de trabalho padrão para o controle de ponto.'
  },
  {
    key: 'tipos_documento',
    href: '/configuracoes/tipos-documento',
    icon: faFileAlt,
    title: 'Tipos de Documento',
    description: 'Gerencie as siglas e descrições dos tipos de documentos para uploads.'
  },
  {
    key: 'integracoes',
    href: '/configuracoes/integracoes',
    icon: faNetworkWired,
    title: 'Integrações',
    description: 'Configure as chaves e credenciais de APIs externas, como a do WhatsApp.'
  },
  {
    key: 'materiais',
    href: '/configuracoes/materiais',
    icon: faBox,
    title: 'Base de Materiais',
    description: 'Gerencie a base de dados central de materiais e serviços para orçamentos.'
  },
  {
    key: 'treinamento_ia',
    href: '/configuracoes/treinamento-ia',
    icon: faRobot,
    title: 'Treinamento da IA',
    description: 'Acompanhe o que a IA Stella já aprendeu e gerencie seu conhecimento.'
  },
  {
    key: 'feedback',
    href: '/configuracoes/feedback',
    icon: faInbox,
    title: 'Central de Feedback',
    description: 'Envie sugestões ou visualize os feedbacks recebidos dos usuários.'
  },
  {
    key: 'politicas',
    href: '/configuracoes/politicas',
    icon: faFileContract,
    title: 'Políticas de Uso',
    description: 'Leia os Termos de Uso e a Política de Privacidade do sistema.'
  },
  {
    key: 'menu',
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

  // Array para armazenar as opções que o usuário pode ver
  const availableOptions = [];

  // Itera sobre cada opção de configuração para verificar a permissão
  for (const option of settingsOptions) {
    // Itens públicos que todos podem ver, não precisam de verificação
    if (['politicas', 'feedback', 'menu'].includes(option.key)) {
      availableOptions.push(option);
      continue; // Pula para a próxima iteração do loop
    }

    // Para os outros itens, construímos a chave da permissão e verificamos
    // Ex: "config_view_usuarios", "config_view_permissoes"
    const permissionKey = `config_view_${option.key}`;
    const hasPermission = await checkPermission(permissionKey);

    // Se o usuário tiver a permissão, adicionamos o cartão à lista
    if (hasPermission) {
      availableOptions.push(option);
    }
  }

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
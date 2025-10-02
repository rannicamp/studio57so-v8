// Local do Arquivo: app/(main)/configuracoes/page.js
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUsers, faLock, faBars, faFileInvoiceDollar, 
    faFileAlt, faRoute, faComments, faTools, 
    faChartPie, faChartLine // ##### 1. IMPORTE O NOVO ÍCONE #####
} from '@fortawesome/free-solid-svg-icons';

const ConfigCard = ({ href, icon, title, description }) => (
    <Link href={href}>
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-transform transform hover:-translate-y-1 cursor-pointer h-full flex flex-col dark:bg-gray-800">
            <FontAwesomeIcon icon={icon} className="text-3xl text-blue-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2 dark:text-white">{title}</h3>
            <p className="text-gray-600 text-sm flex-grow dark:text-gray-300">{description}</p>
        </div>
    </Link>
);

export default function ConfiguracoesPage() {
    return (
        <div className="p-4 md:p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Configurações</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                
                {/* ##### 2. NOVO CARD DE COTAÇÕES ADICIONADO AQUI ##### */}
                <ConfigCard 
                    href="/configuracoes/cotacoes"
                    icon={faChartLine}
                    title="Cotações"
                    description="Gerencie a exibição de cotações de moedas e commodities no sistema."
                />
                
                <ConfigCard 
                    href="/configuracoes/usuarios"
                    icon={faUsers}
                    title="Usuários"
                    description="Gerencie os usuários do sistema, suas funções e permissões de acesso."
                />
                <ConfigCard 
                    href="/configuracoes/painel/construtor"
                    icon={faChartPie}
                    title="Construtor de KPIs"
                    description="Crie e gerencie os KPIs personalizados que aparecem no seu painel de controle."
                />
                <ConfigCard 
                    href="/configuracoes/permissoes"
                    icon={faLock}
                    title="Funções e Permissões"
                    description="Defina as funções dos usuários e o que cada uma pode visualizar ou editar no sistema."
                />
                <ConfigCard 
                    href="/configuracoes/menu"
                    icon={faBars}
                    title="Menu Lateral"
                    description="Personalize a ordem e a visibilidade dos itens no menu lateral para cada função."
                />
                <ConfigCard 
                    href="/configuracoes/financeiro/importar"
                    icon={faFileInvoiceDollar}
                    title="Financeiro"
                    description="Configure categorias, contas e opções de importação para o módulo financeiro."
                />
                <ConfigCard 
                    href="/configuracoes/tipos-documento"
                    icon={faFileAlt}
                    title="Tipos de Documento"
                    description="Gerencie os tipos de documentos utilizados em anexos (ex: RG, Contrato Social)."
                />
                <ConfigCard 
                    href="/configuracoes/jornadas"
                    icon={faRoute}
                    title="Jornadas de Trabalho"
                    description="Configure as jornadas de trabalho padrão para os funcionários."
                />
                <ConfigCard 
                    href="/configuracoes/feedback/visualizar"
                    icon={faComments}
                    title="Feedbacks"
                    description="Visualize os feedbacks e sugestões enviados pelos usuários do sistema."
                />
                <ConfigCard 
                    href="/configuracoes/integracoes"
                    icon={faTools}
                    title="Integrações"
                    description="Conecte o sistema com ferramentas externas como WhatsApp e plataformas de anúncios."
                />
            </div>
        </div>
    );
}
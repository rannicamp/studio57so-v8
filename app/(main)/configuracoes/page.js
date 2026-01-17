'use client';

import { useLayout } from '@/contexts/LayoutContext';
import { useEffect } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUsers, 
    faLock, 
    faFileInvoiceDollar, 
    faFileAlt, 
    faComments, 
    faTools, 
    faChartPie, 
    faChartLine,
    faBoxOpen,      
    faRobot,        
    faShieldAlt,    
    faUserTie,
    faBell
} from '@fortawesome/free-solid-svg-icons';

const ConfigCard = ({ href, icon, title, description, color = "bg-blue-50 text-blue-600" }) => (
    <Link href={href} className="block group h-full">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 h-full flex flex-col hover:-translate-y-1">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform duration-200`}>
                <FontAwesomeIcon icon={icon} size="lg" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                {title}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed flex-grow">
                {description}
            </p>
        </div>
    </Link>
);

export default function ConfiguracoesPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle('Configurações');
    }, [setPageTitle]);

    const configOptions = [
        {
            title: 'Notificações Automáticas',
            description: 'Crie regras para o sistema avisar a equipe quando dados importantes mudarem.',
            icon: faBell,
            href: '/configuracoes/notificacoes',
            color: 'bg-yellow-50 text-yellow-600'
        },
        {
            title: 'Recursos Humanos',
            description: 'Gerencie cargos, funções e jornadas de trabalho da equipe.',
            icon: faUserTie,
            href: '/configuracoes/rh',
            color: 'bg-blue-50 text-blue-600'
        },
        {
            title: 'Cotações',
            description: 'Gerencie a exibição de cotações de moedas e commodities no sistema.',
            icon: faChartLine,
            href: '/configuracoes/cotacoes',
            color: 'bg-green-50 text-green-600'
        },
        {
            title: 'Usuários',
            description: 'Gerencie os usuários do sistema, suas funções e permissões de acesso.',
            icon: faUsers,
            href: '/configuracoes/usuarios',
            color: 'bg-purple-50 text-purple-600'
        },
        {
            title: 'Construtor de KPIs',
            description: 'Crie e gerencie os KPIs personalizados que aparecem no seu painel de controle.',
            icon: faChartPie,
            href: '/configuracoes/painel/construtor',
            color: 'bg-indigo-50 text-indigo-600'
        },
        {
            title: 'Funções e Permissões',
            description: 'Defina as funções dos usuários e o que cada uma pode visualizar ou editar.',
            icon: faLock,
            href: '/configuracoes/permissoes',
            color: 'bg-red-50 text-red-600'
        },
        {
            title: 'Financeiro',
            description: 'Central de configurações financeiras: Categorias, Contas, Importação e Conciliação.',
            icon: faFileInvoiceDollar,
            href: '/configuracoes/financeiro', // <--- LINK ATUALIZADO
            color: 'bg-emerald-50 text-emerald-600'
        },
        {
            title: 'Tipos de Documento',
            description: 'Gerencie os tipos de documentos utilizados em anexos (ex: RG, Contrato Social).',
            icon: faFileAlt,
            href: '/configuracoes/tipos-documento',
            color: 'bg-orange-50 text-orange-600'
        },
        {
            title: 'Materiais e Insumos',
            description: 'Gerencie o catálogo de materiais usados nas obras e orçamentos.',
            icon: faBoxOpen,
            href: '/configuracoes/materiais',
            color: 'bg-amber-50 text-amber-600'
        },
        {
            title: 'Treinamento IA',
            description: 'Carregue documentos para treinar a Inteligência Artificial do sistema.',
            icon: faRobot,
            href: '/configuracoes/treinamento-ia',
            color: 'bg-cyan-50 text-cyan-600'
        },
        {
            title: 'Políticas e Termos',
            description: 'Configure os termos de uso e políticas de privacidade.',
            icon: faShieldAlt,
            href: '/configuracoes/politicas',
            color: 'bg-slate-50 text-slate-600'
        },
        {
            title: 'Feedbacks',
            description: 'Visualize os feedbacks e sugestões enviados pelos usuários.',
            icon: faComments,
            href: '/configuracoes/feedback/visualizar',
            color: 'bg-teal-50 text-teal-600'
        },
        {
            title: 'Integrações',
            description: 'Conecte o sistema com ferramentas externas como WhatsApp e plataformas de anúncios.',
            icon: faTools,
            href: '/configuracoes/integracoes',
            color: 'bg-gray-50 text-gray-600'
        }
    ];

    return (
        <div className="w-full p-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Configurações</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {configOptions.map((option, index) => (
                    <ConfigCard key={index} {...option} />
                ))}
            </div>
        </div>
    );
}
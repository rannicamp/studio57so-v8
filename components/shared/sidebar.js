"use client";

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
    faClipboardList, faAddressBook, faDollarSign, faShoppingCart,
    faInbox, faBullseye, faFileSignature, faCalculator,
    faBoxOpen, faFileInvoiceDollar, faTags, faCube
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
// CORREÇÃO: Usando @/ para o contexto
import { useAuth } from '@/contexts/AuthContext';
import Tooltip from './Tooltip';

export default function Sidebar({ isOpen, closeSidebar }) {
    const { hasPermission, user } = useAuth();
    const sidebarPosition = user?.sidebar_position || 'left';
    
    // Configuração dos itens - Totalmente Mapeada
    const navSections = [
        {
            title: 'Administrativo',
            items: [
                { href: '/painel', label: 'Painel', icon: faTachometerAlt, recurso: 'painel' },
                { href: '/financeiro', label: 'Financeiro', icon: faDollarSign, recurso: 'financeiro' },
                { href: '/recursos-humanos', label: 'Recursos Humanos', icon: faUsers, recurso: 'recursos_humanos' },
                { href: '/empresas', label: 'Empresas', icon: faBuilding, recurso: 'empresas' },
                { href: '/empreendimentos', label: 'Empreendimentos', icon: faProjectDiagram, recurso: 'empreendimentos' },
                { href: '/contratos', label: 'Contratos', icon: faFileSignature, recurso: 'contratos' },
            ]
        },
        {
            title: 'Comercial',
            items: [
                { href: '/caixa-de-entrada', label: 'Caixa de Entrada', icon: faInbox, recurso: 'caixa_de_entrada' },
                { href: '/crm', label: 'Funil de Vendas', icon: faBullseye, recurso: 'crm' },
                { href: '/comercial/tabela-de-vendas', label: 'Tabela de Vendas', icon: faTags, recurso: 'tabela_vendas' },
                { href: '/comercial/anuncios', label: 'Anúncios', icon: faMeta, recurso: 'anuncios' },
                { href: '/contatos', label: 'Contatos', icon: faAddressBook, recurso: 'contatos' },
                { href: '/simulador-financiamento', label: 'Simulador', icon: faCalculator, recurso: 'simulador', target: '_blank' },
            ]
        },
        {
            title: 'Obra',
            items: [
                { href: '/orcamento', label: 'Orçamentação', icon: faFileInvoiceDollar, recurso: 'orcamento' },
                { href: '/pedidos', label: 'Pedidos de Compra', icon: faShoppingCart, recurso: 'pedidos' },
                { href: '/almoxarifado', label: 'Almoxarifado', icon: faBoxOpen, recurso: 'almoxarifado' },
                { href: '/rdo/gerenciador', label: 'Diário de Obra', icon: faClipboardList, recurso: 'rdo' },
                { href: '/atividades', label: 'Atividades', icon: faTasks, recurso: 'atividades' },
            ]
        },
        {
            title: 'Coordenação BIM',
            items: [
                { href: '/bim-manager', label: 'BIM Manager', icon: faCube, recurso: 'bim' },
            ]
        },
    ];

    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
    const logoIconUrl = "/favicon.ico";

    const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';

    if (isHorizontal) {
        const allItems = navSections.flatMap(section => section.items || []);
        return (
            <aside className={`bg-white shadow-lg h-[65px] w-full fixed left-0 z-40 flex items-center justify-center px-4 transition-all ${sidebarPosition === 'top' ? 'top-[65px]' : 'bottom-0'}`}>
                <div className="absolute left-4 flex items-center">
                    <Link href="/painel">
                        <img src={logoIconUrl} alt="Logo" className="h-8 w-auto" />
                    </Link>
                </div>
                <nav className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-2 max-w-[80vw]">
                    {allItems.map((item) => {
                        const canViewItem = hasPermission(item.recurso, 'pode_ver') || ['painel', 'perfil', 'caixa_de_entrada'].includes(item.recurso);
                        if (!item || !canViewItem) return null;
                        return (
                            <Tooltip key={item.label} label={item.label} position={sidebarPosition === 'top' ? 'bottom' : 'top'}>
                                <Link
                                    href={item.href}
                                    target={item.target}
                                    rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                    className="flex items-center justify-center h-10 w-10 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                >
                                    <FontAwesomeIcon icon={item.icon} className="text-lg" />
                                </Link>
                            </Tooltip>
                        );
                    })}
                </nav>
            </aside>
        );
    }

    const drawerBaseClasses = "fixed top-0 bottom-0 z-50 w-[280px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out h-full overflow-y-auto";
    const drawerPositionClass = sidebarPosition === 'right' 
        ? `right-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}` 
        : `left-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
                    onClick={closeSidebar}
                ></div>
            )}

            <aside className={`${drawerBaseClasses} ${drawerPositionClass}`}>
                <div className="flex items-center justify-center h-[65px] border-b border-gray-100 sticky top-0 bg-white z-10">
                    <Link href="/painel" onClick={closeSidebar}>
                        <img src={logoUrl} alt="Logo Studio 57" className="h-9 w-auto" />
                    </Link>
                </div>

                <nav className="mt-4 pb-20">
                    <ul>
                        {navSections.map((section) => {
                            const sectionItems = section.items || [];
                            const visibleItems = sectionItems.filter(item => 
                                hasPermission(item.recurso, 'pode_ver') || ['painel', 'perfil', 'caixa_de_entrada'].includes(item.recurso)
                            );

                            if (visibleItems.length === 0) return null;

                            return (
                                <li key={section.title} className="mb-6">
                                    <h3 className="px-6 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                        {section.title}
                                    </h3>

                                    <ul>
                                        {visibleItems.map((item) => (
                                            <li key={item.label}>
                                                <Link
                                                    href={item.href}
                                                    target={item.target}
                                                    onClick={closeSidebar}
                                                    rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                                    className="flex items-center py-3 px-6 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 border-l-4 border-transparent hover:border-blue-600"
                                                >
                                                    <FontAwesomeIcon icon={item.icon} className="text-lg w-6" />
                                                    <span className="ml-4 text-sm font-medium">{item.label}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
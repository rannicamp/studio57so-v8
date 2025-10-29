// components/sidebar.js
// CÓDIGO ATUALIZADO E CORRIGIDO

"use client";

import { useState } from 'react';
import Link from 'next/link';
// O PORQUÊ DA MUDANÇA: useQuery e a função fetchEmpreendimentos foram removidos, pois não vamos mais buscar a lista de empreendimentos para exibir no menu lateral.
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
    faClipboardList, faCog, faChevronLeft, faChevronRight, faClock,
    faAddressBook, faDollarSign, faShoppingCart,
    faInbox, faBullseye, faFileSignature, faCalculator,
    faChevronDown, faBoxOpen, faFileInvoiceDollar, faTags
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import Tooltip from './Tooltip';

export default function Sidebar({ isCollapsed, toggleSidebar }) {
    const { hasPermission, user } = useAuth();
    const sidebarPosition = user?.sidebar_position || 'left';
    
    // O PORQUÊ DA MUDANÇA: A lógica para abrir e fechar o submenu de empreendimentos foi removida por não ser mais necessária.

    // =================================================================================
    // INÍCIO DA ATUALIZAÇÃO PRINCIPAL
    // O PORQUÊ: A seção "Empreendimentos" foi removida como um item especial com submenu.
    // Em seu lugar, um link simples para "/empreendimentos" foi adicionado dentro da
    // seção "Administrativo", garantindo que ele funcione em todas as posições da sidebar.
    // =================================================================================
    const navSections = [
        {
            title: 'Administrativo',
            items: [
                // =================================================================
                // INÍCIO DA CORREÇÃO 1 de 3
                // O PORQUÊ: O link do "Painel" agora aponta para /painel,
                // pois / é a homepage pública.
                { href: '/painel', label: 'Painel', icon: faTachometerAlt, recurso: 'painel' },
                // FIM DA CORREÇÃO 1 de 3
                // =================================================================
                { href: '/financeiro', label: 'Financeiro', icon: faDollarSign, recurso: 'financeiro' },
                { 
                    href: '/recursos-humanos', 
                    label: 'Recursos Humanos', 
                    icon: faUsers, 
                    recurso: 'recursos_humanos'
                },
                { href: '/empresas', label: 'Empresas', icon: faBuilding, recurso: 'empresas' },
                { href: '/empreendimentos', label: 'Empreendimentos', icon: faProjectDiagram, recurso: 'empreendimentos' },
                { href: '/contratos', label: 'Contratos', icon: faFileSignature, recurso: 'contratos' },
            ]
        },
        // A seção especial 'Empreendimentos' foi removida daqui.
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
    ];
    // =================================================================================
    // FIM DA ATUALIZAÇÃO PRINCIPAL
    // =================================================================================

    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
    const logoIconUrl = "/favicon.ico";

    const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';

    if (isHorizontal) {
        // O PORQUÊ DA MUDANÇA: Como "Empreendimentos" agora faz parte do `items` de uma seção,
        // a lógica abaixo já o incluirá automaticamente na barra horizontal, corrigindo o bug.
        const allItems = navSections.flatMap(section => section.items || []);

        return (
            <aside className={`bg-white shadow-lg h-[65px] w-full fixed left-0 ${sidebarPosition === 'top' ? 'top-[65px]' : 'bottom-0'} z-40 flex items-center justify-center px-4`}>
                <div className="absolute left-4">
                    {/* =================================================================
                    // INÍCIO DA CORREÇÃO 2 de 3
                    // O PORQUÊ: O logo na barra horizontal também deve levar
                    // o usuário logado para o /painel.
                    // ================================================================= */}
                    <Link href="/painel">
                        <img src={logoIconUrl} alt="Logo Studio 57" className="h-8 w-auto" />
                    </Link>
                    {/* FIM DA CORREÇÃO 2 de 3 */}
                </div>
                <nav className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-2">
                    {allItems.map((item) => {
                        // =================================================================
                        // INÍCIO DA CORREÇÃO (Mantida da última vez)
                        // O PORQUÊ: Removemos 'caixa_de_entrada' e 'anuncios' da lista de exceções.
                        // =================================================================
                        const canViewItem = hasPermission(item.recurso, 'pode_ver') || ['painel', 'perfil'].includes(item.recurso);
                        // FIM DA CORREÇÃO (Mantida da última vez)
                        // =================================================================
                        if (!item || !canViewItem) return null;
                        return (
                            <Tooltip key={item.label} label={item.label} position={sidebarPosition === 'top' ? 'bottom' : 'top'}>
                                <Link
                                    href={item.href}
                                    target={item.target}
                                    rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                    className="flex items-center justify-center h-12 w-12 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
                                >
                                    <FontAwesomeIcon icon={item.icon} className="text-xl" />
                                </Link>
                            </Tooltip>
                        );
                    })}
                </nav>
            </aside>
        );
    }

    return (
        <aside className={`bg-white shadow-lg h-full fixed top-0 z-40 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
            <div className="flex items-center justify-center h-[65px] border-b border-gray-200 flex-shrink-0">
                 {/* =================================================================
                // INÍCIO DA CORREÇÃO 3 de 3
                // O PORQUÊ: O logo na barra vertical também deve levar
                // o usuário logado para o /painel.
                // ================================================================= */}
                <Link href="/painel">
                    <img src={isCollapsed ? logoIconUrl : logoUrl} alt="Logo Studio 57" className={`transition-all duration-300 ${isCollapsed ? 'h-8' : 'h-10'} w-auto`} />
                </Link>
                {/* FIM DA CORREÇÃO 3 de 3 */}
            </div>
            <nav className="mt-4 flex-grow flex flex-col">
                <ul className="overflow-y-auto">
                    {navSections.map((section) => {
                        const sectionItems = section.items || [];
                        
                        // =================================================================
                        // INÍCIO DA CORREÇÃO (Mantida da última vez)
                        // O PORQUÊ: Também precisamos corrigir a lista de exceções aqui.
                        // =================================================================
                        const hasVisibleItems = sectionItems.some(item => 
                            hasPermission(item.recurso, 'pode_ver') || ['painel', 'perfil'].includes(item.recurso)
                        );
                        // FIM DA CORREÇÃO (Mantida da última vez)
                        // =================================================================

                        if (!hasVisibleItems) return null;

                        return (
                            <li key={section.title} className="mb-2">
                                {!isCollapsed && ( <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider my-2">{section.title}</h3> )}
                                {isCollapsed && ( <div className="flex justify-center my-4"><div className="w-8 border-t border-gray-200"></div></div> )}

                                <ul>
                                    {sectionItems.map((item) => {
                                        // =================================================================
                                        // INÍCIO DA CORREÇÃO (Mantida da última vez)
                                        // O PORQUÊ: E corrigimos a lista de exceções aqui pela última vez.
                                        // =================================================================
                                        const canViewItem = hasPermission(item.recurso, 'pode_ver') || ['painel', 'perfil'].includes(item.recurso);
                                        // FIM DA CORREÇÃO (Mantida da última vez)
                                        // =================================================================
                                        if (!canViewItem) return null;

                                        return (
                                            <li key={item.label}>
                                                <Tooltip label={item.label} position={sidebarPosition === 'left' ? 'right' : 'left'}>
                                                    <Link
                                                        href={item.href}
                                                        target={item.target}
                                                        rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                                                        className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 w-full ${isCollapsed ? 'justify-center' : 'px-6'}`}
                                                    >
                                                        <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                                                        {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                                                    </Link>
                                                </Tooltip>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        )})}
                </ul>
            </nav>
            <div className="border-t border-gray-200 p-2">
                <button onClick={toggleSidebar} className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                    <FontAwesomeIcon icon={isCollapsed ? (sidebarPosition === 'right' ? faChevronLeft : faChevronRight) : (sidebarPosition === 'right' ? faChevronRight : faChevronLeft)} size="lg" />
                </button>
            </div>
        </aside>
    );
};
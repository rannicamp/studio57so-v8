"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
    faClipboardList, faCog, faChevronLeft, faChevronRight, faClock,
    faAddressBook, faDollarSign, faShoppingCart,
    faInbox, faBullseye, faFileSignature, faCalculator,
    // =================================================================================
    // INÍCIO DA CORREÇÃO
    // O PORQUÊ: Adicionamos o novo ícone para a Orçamentação.
    // =================================================================================
    faChevronDown, faBoxOpen, faFileInvoiceDollar
    // =================================================================================
    // FIM DA CORREÇÃO
    // =================================================================================
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '../utils/supabase/client';
import Tooltip from './Tooltip';

const fetchEmpreendimentos = async (organizacaoId) => {
    if (!organizacaoId) return [];
    const supabase = createClient();
    const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId)
        .order('nome');

    if (error) {
        console.error("Erro ao buscar empreendimentos para o menu:", error);
        throw new Error('Não foi possível buscar os empreendimentos.');
    }
    return data || [];
};

export default function Sidebar({ isCollapsed, toggleSidebar }) {
    const { hasPermission, user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const sidebarPosition = user?.sidebar_position || 'left';

    const { data: empreendimentos = [] } = useQuery({
        queryKey: ['empreendimentosMenu', organizacaoId],
        queryFn: () => fetchEmpreendimentos(organizacaoId),
        enabled: !!organizacaoId
    });

    const [isEmpreendimentosOpen, setIsEmpreendimentosOpen] = useState(true);

    const navSections = [
        {
            title: 'Administrativo',
            items: [
                { href: '/', label: 'Painel', icon: faTachometerAlt, recurso: 'painel' },
                { href: '/financeiro', label: 'Financeiro', icon: faDollarSign, recurso: 'financeiro' },
                { href: '/funcionarios', label: 'Funcionários', icon: faUsers, recurso: 'funcionarios' },
                { href: '/ponto', label: 'Controle de Ponto', icon: faClock, recurso: 'ponto' },
                { href: '/empresas', label: 'Empresas', icon: faBuilding, recurso: 'empresas' },
                { href: '/contratos', label: 'Contratos', icon: faFileSignature, recurso: 'contratos' },
            ]
        },
        {
            title: 'Empreendimentos',
            render: (isCollapsed, isMenuOpen, setMenuOpen) => {
                const canViewEmpreendimentos = hasPermission('empreendimentos', 'pode_ver');
                if (!canViewEmpreendimentos) return null;
                return (
                    <>
                        <button onClick={() => !isCollapsed && setMenuOpen(!isMenuOpen)} className="flex items-center justify-between w-full py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 px-6">
                            <div className="flex items-center">
                                <FontAwesomeIcon icon={faProjectDiagram} className="text-lg w-6" />
                                <span className="ml-4 text-sm font-medium">Empreendimentos</span>
                            </div>
                            <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isMenuOpen && (
                            <ul className="bg-gray-50 border-l-4 border-gray-200 ml-6 pl-2">
                                <li><Link href="/empreendimentos" className="flex items-center py-2 px-4 text-gray-600 hover:bg-gray-200 text-sm"><span className="w-6 text-center">-</span> Ver Todos</Link></li>
                                {empreendimentos.map(emp => (
                                    <li key={emp.id}><Link href={`/empreendimentos/${emp.id}`} className="flex items-center py-2 px-4 text-gray-600 hover:bg-gray-200 text-sm group"><FontAwesomeIcon icon={faBoxOpen} className="w-6 text-center text-gray-400 group-hover:text-blue-500" /> {emp.nome}</Link></li>
                                ))}
                            </ul>
                        )}
                    </>
                );
            }
        },
        {
            title: 'Comercial',
            items: [
                { href: '/caixa-de-entrada', label: 'Caixa de Entrada', icon: faInbox, recurso: 'caixa_de_entrada' },
                { href: '/crm', label: 'Funil de Vendas', icon: faBullseye, recurso: 'crm' },
                { href: '/comercial/anuncios', label: 'Anúncios', icon: faMeta, recurso: 'anuncios' },
                { href: '/contatos', label: 'Contatos', icon: faAddressBook, recurso: 'contatos' },
                { href: '/simulador-financiamento', label: 'Simulador', icon: faCalculator, recurso: 'simulador', target: '_blank' },
            ]
        },
        {
            title: 'Obra',
            items: [
                // =================================================================================
                // INÍCIO DA CORREÇÃO
                // O PORQUÊ: Trocamos o ícone de 'faDollarSign' para 'faFileInvoiceDollar'
                // para diferenciar visualmente "Orçamentação" de "Financeiro".
                // =================================================================================
                { href: '/orcamento', label: 'Orçamentação', icon: faFileInvoiceDollar, recurso: 'orcamento' },
                // =================================================================================
                // FIM DA CORREÇÃO
                // =================================================================================
                { href: '/pedidos', label: 'Pedidos de Compra', icon: faShoppingCart, recurso: 'pedidos' },
                { href: '/almoxarifado', label: 'Almoxarifado', icon: faBoxOpen, recurso: 'almoxarifado' },
                { href: '/rdo/gerenciador', label: 'Diário de Obra', icon: faClipboardList, recurso: 'rdo' },
                { href: '/atividades', label: 'Atividades', icon: faTasks, recurso: 'atividades' },
            ]
        },
    ];

    const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
    const logoIconUrl = "/favicon.ico";

    const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';

    if (isHorizontal) {
        const positionClass = sidebarPosition === 'top' ? 'top-[65px]' : 'bottom-0';
        const allItems = navSections.flatMap(section => section.items || []);

        return (
            <aside className={`bg-white shadow-lg h-[65px] w-full fixed left-0 ${positionClass} z-40 flex items-center justify-center px-4`}>
                <div className="absolute left-4">
                    <Link href="/">
                        <img src={logoIconUrl} alt="Logo Studio 57" className="h-8 w-auto" />
                    </Link>
                </div>
                <nav className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-2">
                    {allItems.map((item) => {
                        const canViewItem = hasPermission(item.recurso, 'pode_ver') || ['caixa_de_entrada', 'painel', 'perfil', 'anuncios'].includes(item.recurso);
                        if (!canViewItem) return null;
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
                <Link href="/">
                    <img src={isCollapsed ? logoIconUrl : logoUrl} alt="Logo Studio 57" className={`transition-all duration-300 ${isCollapsed ? 'h-8' : 'h-10'} w-auto`} />
                </Link>
            </div>
            <nav className="mt-4 flex-grow flex flex-col">
                <ul className="overflow-y-auto">
                    {navSections.map((section) => {
                        if (isCollapsed && section.render) return null;
                        
                        return (
                            <li key={section.title} className="mb-2">
                                {!isCollapsed && section.title !== 'Empreendimentos' && ( <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider my-2">{section.title}</h3> )}
                                {isCollapsed && section.title !== 'Empreendimentos' && ( <div className="flex justify-center my-4"><div className="w-8 border-t border-gray-200"></div></div> )}

                                {section.items ? (
                                    <ul>
                                        {section.items.map((item) => {
                                            const canViewItem = hasPermission(item.recurso, 'pode_ver') || ['caixa_de_entrada', 'painel', 'perfil', 'anuncios'].includes(item.recurso);
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
                                ) : ( section.render(isCollapsed, isEmpreendimentosOpen, setIsEmpreendimentosOpen) )}
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
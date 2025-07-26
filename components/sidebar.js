"use client";

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faCog, faChevronLeft, faChevronRight, faClock,
  faAddressBook, faDollarSign, faShoppingCart, faUserCog,
  faSitemap, faBug, faInbox, faBullseye
} from '@fortawesome/free-solid-svg-icons';

export default function Sidebar({ isCollapsed, toggleSidebar, isAdmin }) {
  const navSections = [
    {
      title: 'Administrativo',
      items: [
        { href: '/', label: 'Dashboard', icon: faTachometerAlt },
        { href: '/financeiro', label: 'Financeiro', icon: faDollarSign },
        { href: '/funcionarios', label: 'Funcionários', icon: faUsers },
        { href: '/ponto', label: 'Controle de Ponto', icon: faClock },
        { href: '/perfil', label: 'Meu Perfil', icon: faUserCog },
        { href: '/atividades', label: 'Atividades', icon: faTasks },
        { href: '/empresas', label: 'Empresas', icon: faBuilding },
      ]
    },
    {
      title: 'Obras',
      items: [
        { href: '/empreendimentos', label: 'Empreendimentos', icon: faProjectDiagram },
        { href: '/orcamento', label: 'Orçamentária', icon: faDollarSign },
        { href: '/pedidos', label: 'Pedidos de Compra', icon: faShoppingCart },
        { href: '/rdo/gerenciador', label: 'Diário de Obra', icon: faClipboardList },
      ]
    },
    {
      title: 'Comercial',
      items: [
        { href: '/crm', label: 'CRM', icon: faBullseye },
        { href: '/contatos', label: 'Contatos', icon: faAddressBook },
      ]
    }
  ];

  // ***** INÍCIO DA ALTERAÇÃO *****
  // Adicionado um array para o item de feedback que é sempre visível.
  const bottomNavAlwaysVisible = [
      { href: '/configuracoes/feedback/enviar', label: 'Enviar Feedback', icon: faInbox },
  ];
  // ***** FIM DA ALTERAÇÃO *****

  const bottomNavItems = [
    isAdmin && { href: '/configuracoes', label: 'Configurações', icon: faCog },
  ].filter(Boolean);

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
  const logoIconUrl = "/favicon.ico";

  return (
    <aside className={`bg-white shadow-lg h-full fixed left-0 top-0 z-40 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <div className="flex items-center justify-center h-[65px] border-b border-gray-200 flex-shrink-0">
        <Link href="/">
          <img
            src={isCollapsed ? logoIconUrl : logoUrl}
            alt="Logo Studio 57"
            className={`transition-all duration-300 ${isCollapsed ? 'h-8' : 'h-10'} w-auto`}
          />
        </Link>
      </div>
      <nav className="mt-4 flex-grow overflow-y-auto">
        <ul>
          {navSections.map((section) => (
            <li key={section.title} className="mb-4">
              {!isCollapsed && (
                <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
              )}
              {isCollapsed && (
                  <div className="flex justify-center my-4">
                     <div className="w-8 border-t border-gray-200"></div>
                  </div>
              )}
              <ul>
                {section.items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                      <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                      {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
      <nav className="mt-auto mb-2 flex-shrink-0">
        <ul>
          {/* ***** INÍCIO DA ALTERAÇÃO ***** */}
          {/* Renderiza o link de feedback para todos os usuários */}
          {bottomNavAlwaysVisible.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
          {/* ***** FIM DA ALTERAÇÃO ***** */}
          
          {bottomNavItems.map((item) => (
            item && (
              <li key={item.label}>
                <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                  <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                  {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                </Link>
              </li>
            )
          ))}
        </ul>
      </nav>
      <div className="border-t border-gray-200 p-2">
        <button onClick={toggleSidebar} className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
          <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} size="lg" />
        </button>
      </div>
    </aside>
  );
};
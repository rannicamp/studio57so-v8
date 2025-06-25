"use client";

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt,
  faBuilding,
  faProjectDiagram,
  faUsers,
  faTasks,
  faClipboardList,
  faCog,
  faUserCog,
  faChevronDown,
  faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

export default function Sidebar({ isCollapsed, isAdmin }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ATUALIZADO: Itens de navegação principais
  const mainNavItems = [
    { href: '/', label: 'Dashboard', icon: faTachometerAlt },
    { href: '/empresas/cadastro', label: 'Cadastro de Empresa', icon: faBuilding },
    { href: '/empreendimentos/cadastro', label: 'Cadastro de Empreendimento', icon: faProjectDiagram },
    { href: '/funcionarios', label: 'Funcionários', icon: faUsers },
    { href: '/atividades', label: 'Painel de Atividades', icon: faTasks },
    // O item de RDO agora é um link direto para o gerenciador
    { href: '/rdo/gerenciador', label: 'Diário de Obra (RDO)', icon: faClipboardList },
  ];

  const bottomNavItems = [];

  if (isAdmin) {
    bottomNavItems.push({
      label: 'Configurações',
      icon: faCog,
      type: 'dropdown',
      isOpen: isSettingsOpen,
      toggle: () => setIsSettingsOpen(!isSettingsOpen),
      subItems: [
        { href: '/configuracoes/usuarios', label: 'Gestão de Usuários', icon: faUserCog },
      ]
    });
  }

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";
  const logoIconUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/marca/public/STUDIO-57-ICON-PRETO.png?t=2024-06-25T15%3A18%3A19.497Z";

  return (
    <aside className={`bg-white shadow-lg h-full fixed left-0 top-0 z-40 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <div className="flex items-center justify-center h-[65px] border-b border-gray-200 flex-shrink-0">
        <Link href="/">
          <img
            src={isCollapsed ? logoIconUrl : logoUrl}
            alt="Logo Studio 57"
            className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-auto' : 'h-12 w-auto'}`}
          />
        </Link>
      </div>
      <nav className="mt-4 flex-grow overflow-y-auto">
        <ul>
          {mainNavItems.map((item) => (
            <li key={item.label}>
              {item.type === 'dropdown' ? (
                 <>
                  <button
                    onClick={item.toggle}
                    className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 w-full text-left ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}
                  >
                    <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                    {!isCollapsed && <span className="ml-4 text-sm font-medium flex-grow">{item.label}</span>}
                    {!isCollapsed && <FontAwesomeIcon icon={item.isOpen ? faChevronUp : faChevronDown} className="text-xs ml-auto" />}
                  </button>
                  {item.isOpen && !isCollapsed && (
                    <ul className="ml-8 border-l border-gray-300">
                      {item.subItems.map((subItem) => (
                        <li key={subItem.href}>
                          <Link href={subItem.href} className="flex items-center py-2 pl-4 text-gray-600 hover:bg-gray-100 transition-colors duration-200 text-sm">
                            <FontAwesomeIcon icon={subItem.icon} className="mr-3 w-5" />
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}>
                  <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                  {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {/* O restante do componente (configurações) permanece o mesmo */}
    </aside>
  );
};
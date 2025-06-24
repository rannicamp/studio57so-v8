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

  const navItems = [
    { href: '/', label: 'Dashboard', icon: faTachometerAlt, type: 'link' },
    { href: '/empresas/cadastro', label: 'Cadastro de Empresa', icon: faBuilding, type: 'link' },
    { href: '/empreendimentos/cadastro', label: 'Cadastro de Empreendimento', icon: faProjectDiagram, type: 'link' },
    { href: '/funcionarios', label: 'Funcionários', icon: faUsers, type: 'link' },
    { href: '/atividades', label: 'Painel de Atividades', icon: faTasks, type: 'link' },
    { href: '/rdo', label: 'Diário de Obra (RDO)', icon: faClipboardList, type: 'link' },
  ];

  // Adiciona o item de configurações apenas se o usuário for admin
  if (isAdmin) {
    navItems.push({ 
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
      <nav className="mt-4 flex-grow"> {/* flex-grow para ocupar o espaço restante */}
        <ul>
          {navItems.filter(item => item.label !== 'Configurações').map((item) => ( // Filtra Configurações aqui
            <li key={item.label}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Seção de Configurações no final do sidebar */}
      {isAdmin && (
        <nav className="mb-4 flex-shrink-0"> {/* flex-shrink-0 para não encolher */}
          <ul>
            <li>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 w-full text-left ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}
              >
                <FontAwesomeIcon icon={faCog} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && (
                  <span className="ml-4 text-sm font-medium flex-grow">Configurações</span>
                )}
                {!isCollapsed && (
                  <FontAwesomeIcon 
                    icon={isSettingsOpen ? faChevronUp : faChevronDown} 
                    className="text-xs ml-auto" 
                  />
                )}
              </button>
              {isSettingsOpen && !isCollapsed && (
                <ul className="ml-8 border-l border-gray-300">
                  <li>
                    <Link href="/configuracoes/usuarios" className="flex items-center py-2 pl-4 text-gray-600 hover:bg-gray-100 transition-colors duration-200 text-sm">
                      <FontAwesomeIcon icon={faUserCog} className="mr-3 w-5" />
                      Gestão de Usuários
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      )}
    </aside>
  );
};
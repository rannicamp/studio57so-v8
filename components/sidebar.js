"use client";

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTachometerAlt, faBuilding, faProjectDiagram, faUsers, faTasks,
  faClipboardList, faCog, faChevronLeft, faChevronRight, faClock,
  faAddressBook, faDollarSign, faShoppingCart, faUserCog,
  faWhatsapp
} from '@fortawesome/free-brands-svg-icons';
import {
  faHome,
  faSitemap,
  faBug // Novo ícone importado
} from '@fortawesome/free-solid-svg-icons';


export default function Sidebar({ isCollapsed, toggleSidebar, isAdmin }) {
  const mainNavItems = [
    { href: '/', label: 'Dashboard', icon: faTachometerAlt },
    { href: '/whatsapp', label: 'WhatsApp Chat', icon: faWhatsapp },
    { href: '/perfil', label: 'Meu Perfil', icon: faUserCog },
    { href: '/atividades', label: 'Painel de Atividades', icon: faTasks },
    { href: '/contatos', label: 'Contatos', icon: faAddressBook },
    { href: '/pedidos', label: 'Pedidos de Compra', icon: faShoppingCart },
    { href: '/orcamento', label: 'Planilha Orçamentária', icon: faDollarSign },
    { href: '/empresas', label: 'Empresas', icon: faBuilding },
    { href: '/empreendimentos', label: 'Gerenciar Empreendimentos', icon: faProjectDiagram },
    { href: '/funcionarios', label: 'Funcionários', icon: faUsers },
    { href: '/rdo/gerenciador', label: 'Diário de Obra (RDO)', icon: faClipboardList },
    { href: '/ponto', label: 'Controle de Ponto', icon: faClock },
    { href: '/financeiro', label: 'Gestão Financeira', icon: faDollarSign }
  ];

  const bottomNavItems = [
    // NOVO ITEM DE MENU ADICIONADO AQUI
    { href: '/feedback', label: 'Reportar Problema', icon: faBug },
    isAdmin && { href: '/configuracoes/integracoes', label: 'Integrações', icon: faSitemap },
    isAdmin && { href: '/configuracoes', label: 'Configurações', icon: faCog },
  ].filter(Boolean); // Filtra itens falsos (caso isAdmin seja false)

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
          {mainNavItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav className="mt-auto mb-2 flex-shrink-0">
        <ul>
          {bottomNavItems.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
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
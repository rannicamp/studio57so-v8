"use client";

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTachometerAlt, 
  faBuilding, 
  faProjectDiagram, 
  faUserPlus, 
  faTasks, 
  faClipboardList 
} from '@fortawesome/free-solid-svg-icons';

// A Sidebar agora recebe a propriedade 'isCollapsed'
export default function Sidebar({ isCollapsed }) {
  
  // Adicionamos ícones a cada item do menu
  const navItems = [
    { href: '/', label: 'Dashboard', icon: faTachometerAlt },
    { href: '/empresas/cadastro', label: 'Cadastro de Empresa', icon: faBuilding },
    { href: '/empreendimentos/cadastro', label: 'Cadastro de Empreendimento', icon: faProjectDiagram },
    { href: '/funcionarios/cadastro', label: 'Cadastro de Funcionário', icon: faUserPlus },
    { href: '/atividades', label: 'Painel de Atividades', icon: faTasks },
    { href: '/rdo', label: 'Diário de Obra (RDO)', icon: faClipboardList },
  ];

  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE";

  return (
    // A largura muda dinamicamente e adicionamos uma transição suave
    <aside className={`bg-white shadow-lg h-full fixed left-0 top-0 z-40 transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      <div className="flex items-center justify-center h-[65px] border-b border-gray-200">
        <Link href="/">
          {/* Mostra apenas a logo pequena quando recolhido */}
          <img 
            src={logoUrl} 
            alt="Logo Studio 57" 
            className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-8 object-contain' : 'h-12 w-auto'}`} 
          />
        </Link>
      </div>
      <nav className="mt-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${isCollapsed ? 'justify-center px-0' : 'px-6'}`}>
                <FontAwesomeIcon icon={item.icon} className={`flex-shrink-0 ${isCollapsed ? 'text-xl' : 'text-lg w-6'}`} />
                {/* O texto do label só aparece se a sidebar não estiver recolhida */}
                {!isCollapsed && <span className="ml-4 text-sm font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
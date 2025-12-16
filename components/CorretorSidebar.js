// components/CorretorSidebar.js
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faUsers, 
  faFileContract, 
  faFolderOpen, 
  faChartLine,
  faBuilding,
  faCalculator // Importei o ícone de calculadora
} from '@fortawesome/free-solid-svg-icons';

export default function CorretorSidebar({ user, onMobileItemClick }) {
  const pathname = usePathname();
  
  // URL da Logo
  const logoUrl = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG";

  // Lista de Links do Menu
  const menuItems = [
    { name: 'Painel Geral', href: '/portal-painel', icon: faHome },
    { name: 'Meus Clientes', href: '/clientes', icon: faUsers },
    { name: 'Tabela de Vendas', href: '/tabela-de-vendas', icon: faChartLine },
    { name: 'Simulador', href: '/simulador-financiamento', icon: faCalculator }, // Adicionei o botão do Simulador aqui
    { name: 'Empreendimentos', href: '/empreendimentosstudio', icon: faBuilding },
    { name: 'Contratos', href: '/portal-contratos', icon: faFileContract },
    { name: 'Arquivos', href: '/portal-arquivos', icon: faFolderOpen },
  ];

  const isActive = (path) => pathname === path || pathname?.startsWith(path + '/');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-center border-b border-gray-100 px-4">
        <div className="relative w-32 h-10">
            <Image 
                src={logoUrl} 
                alt="Studio 57" 
                fill
                className="object-contain"
                priority
            />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onMobileItemClick} // Fecha menu no mobile ao clicar
            className={`
              group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200
              ${isActive(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <FontAwesomeIcon 
              icon={item.icon} 
              className={`
                mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200
                ${isActive(item.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
              `} 
            />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Footer Area (Opcional - Perfil resumido ou versão) */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.nome || 'Corretor'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                    Parceiro Studio 57
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
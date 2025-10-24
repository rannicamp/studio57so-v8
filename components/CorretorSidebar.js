// components/CorretorSidebar.js
'use client'

import { useState, useEffect, useRef } from 'react' // <-- Importa useEffect e useRef
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTachometerAlt,
  faUserFriends,
  faTable,
  faFileSignature,
  faChevronLeft,
  faChevronRight,
  faUserCircle,
  faSpinner,
  faSignOutAlt,
  faCalculator,
  faChevronDown, // <-- Ícone da setinha
  faUser,        // <-- Ícone para Editar Perfil
  faCog,         // <-- Ícone para Configurações
} from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import Tooltip from './Tooltip'
import Image from 'next/image'

// Define os itens específicos para o menu do Corretor (sem mudanças)
const navSections = [
    // ... (seu array navSections continua igual) ...
    {
    title: 'Portal do Corretor',
    items: [
      {
        href: '/portal-painel',
        icon: faTachometerAlt,
        label: 'Painel',
        recurso: 'portal_painel',
      },
      {
        href: '/clientes',
        icon: faUserFriends,
        label: 'Clientes',
        recurso: 'portal_clientes',
      },
      {
        href: '/tabela-de-vendas',
        icon: faTable,
        label: 'Tabela de Vendas',
        recurso: 'portal_tabela_vendas',
      },
      {
        href: '/simulador-financiamento',
        icon: faCalculator,
        label: 'Simulador',
        recurso: 'portal_simulador',
      },
      {
        href: '/portal-contratos',
        icon: faFileSignature,
        label: 'Contratos',
        recurso: 'portal_contratos',
      },
    ],
  },
]

export default function CorretorSidebar({
  user,
  isUserLoading,
  isCollapsed,
  toggleSidebar
}) {

  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  // --- Lógica do Menu Dropdown ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
            setIsMenuOpen(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);
  // --- Fim da Lógica do Menu Dropdown ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    router.push('/login');
  };

  const sidebarPosition = user?.sidebar_position || 'left'

  // Dados do usuário
  const firstName = user?.nome?.split(' ')[0];
  const userName = firstName || user?.email || 'Usuário';
  const userEmail = user?.email || '...';
  const userPhoto = user?.avatar_url || null;

  const logoUrl =
    'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE'
  const logoIconUrl = '/favicon.ico'

  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom'

  // Renderização Horizontal (mantida igual)
  if (isHorizontal) {
    const allItems = navSections.flatMap((section) => section.items || [])
    return (
      <aside
        className={`bg-white shadow-lg h-[65px] w-full fixed left-0 ${
          sidebarPosition === 'top' ? 'top-[65px]' : 'bottom-0'
        } z-40 flex items-center justify-center px-4`}
      >
        <div className="absolute left-4">
          <Link href="/portal-painel">
            <Image src={logoIconUrl} alt="Logo Studio 57" width={32} height={32} />
          </Link>
        </div>
        <nav className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-2">
          {allItems.map((item) => {
            const canViewItem = true;
            if (!item || !canViewItem) return null
            return (
              <Tooltip
                key={item.label}
                label={item.label}
                position={sidebarPosition === 'top' ? 'bottom' : 'top'}
              >
                <Link
                  href={item.href}
                  target={item.target}
                  rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-center h-12 w-12 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200"
                >
                  <FontAwesomeIcon icon={item.icon} className="text-xl" />
                </Link>
              </Tooltip>
            )
          })}
        </nav>
      </aside>
    )
  }

  // Renderização Vertical
  return (
    <aside
      className={`bg-white shadow-lg h-full fixed top-0 z-40 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-[80px]' : 'w-[260px]'
      } ${sidebarPosition === 'left' ? 'left-0' : 'right-0'}`}
    >

      {/* 1. SEÇÃO DO USUÁRIO COM DROPDOWN */}
      <div className="flex-shrink-0 border-b border-gray-200 relative" ref={menuRef}>
        {isUserLoading ? (
          <div className="flex items-center justify-center p-4 h-16">
            <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
          </div>
        ) : user ? (
           <button
             onClick={() => setIsMenuOpen(!isMenuOpen)}
             className={`w-full flex items-center p-4 h-16 text-left hover:bg-gray-50 focus:outline-none ${isCollapsed ? 'justify-center' : ''}`}
           >
             {userPhoto ? (
               <Image src={userPhoto} alt="Foto do perfil" width={36} height={36} className="rounded-full flex-shrink-0" />
             ) : (
               <FontAwesomeIcon icon={faUserCircle} className="text-gray-400 text-3xl flex-shrink-0" />
             )}
             {!isCollapsed && (
               <div className="ml-3 overflow-hidden flex-grow mr-2">
                 <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                 <p className="text-xs text-gray-500 truncate">{userEmail}</p>
               </div>
             )}
             {!isCollapsed && (
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`w-3 h-3 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`}
                />
             )}
           </button>
        ) : (
          <div className={`w-full flex items-center p-4 h-16 text-left ${isCollapsed ? 'justify-center' : ''}`}>
             <FontAwesomeIcon icon={faUserCircle} className="text-red-400 text-3xl flex-shrink-0" />
              {!isCollapsed && (
               <div className="ml-3 overflow-hidden">
                 <p className="text-sm font-semibold text-red-800 truncate">Erro</p>
                 <p className="text-xs text-red-500 truncate">Recarregue</p>
               </div>
             )}
          </div>
        )}

        {/* O Menu Dropdown */}
        {isMenuOpen && !isUserLoading && user && (
            <div className={`absolute mt-1 w-56 bg-white rounded-md shadow-lg z-50 border border-gray-200 ${
                isCollapsed
                    ? (sidebarPosition === 'left' ? 'left-full ml-1 top-0' : 'right-full mr-1 top-0')
                    : (sidebarPosition === 'left' ? 'left-4' : 'right-4')
             }`}>
                <ul className="py-1">
                    <li>
                        {/* ======================= A CORREÇÃO ESTÁ AQUI ======================= */}
                        <Link
                           href="/perfil" // <-- CORRIGIDO para a página existente
                           onClick={() => setIsMenuOpen(false)}
                           className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            <FontAwesomeIcon icon={faUser} className="w-4 h-4 text-gray-500" />
                            <span>Editar Perfil</span>
                        </Link>
                        {/* ======================= FIM DA CORREÇÃO ======================= */}
                    </li>
                    <li>
                        <Link
                          href="/portal-configuracoes" // Mantém o link para a nova página de configurações do portal
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            <FontAwesomeIcon icon={faCog} className="w-4 h-4 text-gray-500" />
                            <span>Configurações</span>
                        </Link>
                    </li>
                    <li className="border-t border-gray-200 my-1"></li>
                    <li>
                       <button
                         onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                         className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                       >
                            <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
                            <span>Sair</span>
                        </button>
                    </li>
                </ul>
            </div>
        )}
      </div>

      {/* 2. SEÇÃO DO LOGO (sem mudanças) */}
      <div className="flex items-center justify-center h-[65px] flex-shrink-0">
        <Link href="/portal-painel">
          <Image
            src={isCollapsed ? logoIconUrl : logoUrl}
            alt="Logo Studio 57"
            width={isCollapsed ? 32 : 150}
            height={isCollapsed ? 32 : 40}
            className={`transition-all duration-300 w-auto ${isCollapsed ? 'h-8' : 'h-10'}`}
            priority
          />
        </Link>
      </div>

      {/* 3. NAVEGAÇÃO (sem mudanças) */}
      <nav className="mt-4 flex-grow flex flex-col">
        <ul className="overflow-y-auto">
          {navSections.map((section) => {
            const sectionItems = section.items || []
            const hasVisibleItems = sectionItems.some(item => true);
            if (!hasVisibleItems) return null
            return (
              <li key={section.title} className="mb-2">
                {!isCollapsed && (
                  <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider my-2">
                    {section.title}
                  </h3>
                )}
                {isCollapsed && (
                  <div className="flex justify-center my-4">
                    <div className="w-8 border-t border-gray-200"></div>
                  </div>
                )}
                <ul>
                  {sectionItems.map((item) => {
                    const canViewItem = true;
                    if (!canViewItem) return null
                    return (
                      <li key={item.label}>
                        <Tooltip
                          label={item.label}
                          position={sidebarPosition === 'left' ? 'right' : 'left'}
                          disabled={!isCollapsed}
                        >
                          <Link
                            href={item.href}
                            target={item.target}
                            rel={
                              item.target === '_blank'
                                ? 'noopener noreferrer'
                                : undefined
                            }
                            className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 w-full ${
                              isCollapsed ? 'justify-center' : 'px-6'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={item.icon}
                              className={`flex-shrink-0 ${
                                isCollapsed ? 'text-xl' : 'text-lg w-6'
                              }`}
                            />
                            {!isCollapsed && (
                              <span className="ml-4 text-sm font-medium">
                                {item.label}
                              </span>
                            )}
                          </Link>
                        </Tooltip>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 4. BOTÃO DE COLAPSAR (sem mudanças) */}
      <div className="border-t border-gray-200 p-2 mt-auto">
        <button
          onClick={toggleSidebar}
          className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
        >
          <FontAwesomeIcon
            icon={
              isCollapsed
                ? sidebarPosition === 'right'
                  ? faChevronLeft
                  : faChevronRight
                : sidebarPosition === 'right'
                ? faChevronRight
                : faChevronLeft
            }
            size="lg"
          />
        </button>
      </div>
    </aside>
  )
}
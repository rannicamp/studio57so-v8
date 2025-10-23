// components/CorretorSidebar.js
'use client'

import { useState } from 'react'
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
  faCalculator, // <-- 1. ÍCONE NOVO
} from '@fortawesome/free-solid-svg-icons'
import { useLayout } from '@/contexts/LayoutContext'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import Tooltip from './Tooltip'
import Image from 'next/image'

// Define os itens específicos para o menu do Corretor
const navSections = [
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
      // --- 2. AQUI ESTÁ O NOVO ITEM ---
      {
        href: '/simulador-financiamento',
        icon: faCalculator,
        label: 'Simulador',
        recurso: 'portal_simulador',
      },
      // --- FIM DO NOVO ITEM ---
      {
        href: '/portal-contratos',
        icon: faFileSignature,
        label: 'Contratos',
        recurso: 'portal_contratos',
      },
    ],
  },
]

// Componente auxiliar para o Avatar (sem mudanças)
function UserAvatar({ user, isCollapsed }) {
  const avatarUrl = user?.avatar_url; 
  const userName = user?.nome || 'Usuário';
  const userEmail = user?.email || '...';

  if (isCollapsed) {
    return (
      <Tooltip label={`${userName} (${userEmail})`} position="right">
        <div className="flex items-center justify-center w-full h-16">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Avatar" width={36} height={36} className="rounded-full" />
          ) : (
            <FontAwesomeIcon icon={faUserCircle} className="text-gray-400 text-3xl" />
          )}
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center p-4 h-16">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="Avatar" width={36} height={36} className="rounded-full" />
      ) : (
        <FontAwesomeIcon icon={faUserCircle} className="text-gray-400 text-3xl" />
      )}
      <div className="ml-3 overflow-hidden">
        <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
      </div>
    </div>
  );
}


export default function CorretorSidebar({ 
  isCollapsed,
  toggleSidebar 
}) {
  
  const { user, isUserLoading } = useLayout()
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    router.push('/login');
  };

  const sidebarPosition = user?.sidebar_position || 'left'

  const logoUrl =
    'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE'
  const logoIconUrl = '/favicon.ico'

  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom'

  // Renderização Horizontal (sem mudanças)
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

  // Renderização Vertical (sem mudanças, apenas o array 'navSections' foi atualizado)
  return (
    <aside
      className={`bg-white shadow-lg h-full fixed top-0 z-40 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-[80px]' : 'w-[260px]'
      } ${sidebarPosition === 'left' ? 'left-0' : 'right-0'}`}
    >
      
      {/* 1. SEÇÃO DO USUÁRIO NO TOPO */}
      <div className="flex-shrink-0 border-b border-gray-200">
        {isUserLoading ? (
          <div className="flex items-center justify-center p-4 h-16">
            <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
          </div>
        ) : user ? (
          <UserAvatar user={user} isCollapsed={isCollapsed} />
        ) : (
          <UserAvatar user={{ nome: 'Erro', email: 'Tente recarregar' }} isCollapsed={isCollapsed} />
        )}
      </div>

      {/* 2. SEÇÃO DO LOGO */}
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

      {/* 3. NAVEGAÇÃO */}
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
      
      {/* 4. BOTÃO DE LOGOUT */}
      <div className="flex-shrink-0 border-t border-gray-200 p-2">
        <Tooltip
          label="Sair do sistema"
          position={sidebarPosition === 'left' ? 'right' : 'left'}
        >
          <button
            onClick={handleLogout}
            className={`flex items-center py-3 text-red-600 hover:bg-red-50 transition-colors duration-200 w-full rounded-md ${
              isCollapsed ? 'justify-center' : 'px-6'
            }`}
          >
            <FontAwesomeIcon
              icon={faSignOutAlt}
              className={`flex-shrink-0 ${
                isCollapsed ? 'text-xl' : 'text-lg w-6'
              }`}
            />
            {!isCollapsed && (
              <span className="ml-4 text-sm font-medium">
                Sair
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* 5. BOTÃO DE COLAPSAR */}
      <div className="border-t border-gray-200 p-2">
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
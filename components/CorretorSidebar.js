// components/CorretorSidebar.js
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome' //
import {
  faTachometerAlt,
  faUserFriends,
  faTable,
  faFileSignature,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons' //
import { useAuth } from '../contexts/AuthContext' // Importa o useAuth corretamente
import Tooltip from './Tooltip' // Importa o Tooltip como no original
import Image from 'next/image' // Para usar a tag Image para o logo

// Define os itens específicos para o menu do Corretor
const navSections = [
  {
    title: 'Portal do Corretor', // Um título genérico para a seção
    items: [
      {
        href: '/portal-painel',
        icon: faTachometerAlt,
        label: 'Painel',
        recurso: 'portal_painel', // Recurso para controle de permissão (se necessário)
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
        href: '/portal-contratos',
        icon: faFileSignature,
        label: 'Contratos',
        recurso: 'portal_contratos',
      },
    ],
  },
]

// Mantém a lógica do componente Sidebar original, adaptando nomes e itens
export default function CorretorSidebar({ isCollapsed: initialIsCollapsed = false, toggleSidebar: initialToggleSidebar }) {
  // Pega user e hasPermission do AuthContext, como no original
  const { hasPermission, user } = useAuth() || {} // Garante que não quebre se o contexto não estiver pronto
  
  // Lógica interna de colapso, caso não seja controlado externamente
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(initialIsCollapsed);
  const isCollapsed = initialToggleSidebar ? initialIsCollapsed : internalIsCollapsed;
  const toggleSidebar = initialToggleSidebar ? initialToggleSidebar : () => setInternalIsCollapsed(!internalIsCollapsed);

  // Pega a posição da sidebar das configurações do usuário, como no original
  const sidebarPosition = user?.sidebar_position || 'left' //

  // URLs dos logos, como no original
  const logoUrl =
    'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/sign/marca/public/STUDIO%2057%20PRETO%20-%20RETANGULAR.PNG?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kMTIyN2I2ZC02YmI4LTQ0OTEtYWE0MS0yZTdiMDdlNDVmMjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXJjYS9wdWJsaWMvU1RVRElPIDU3IFBSRVRPIC0gUkVUQU5HVUxBUi5QTkciLCJpYXQiOjE3NTA3MTA1ODEsImV4cCI6MjA2NjA3MDU4MX0.NKH_ZhXJYjHNpZ5j1suDDRwnggj9zte81D37NFZeCIE' //
  const logoIconUrl = '/favicon.ico' //

  // Verifica se a sidebar é horizontal (não aplicável ao corretor, mas mantém a lógica)
  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom' //

  // Renderização Horizontal (adaptada do original, provavelmente não será usada aqui)
  if (isHorizontal) {
    const allItems = navSections.flatMap((section) => section.items || []) //

    return (
      <aside
        className={`bg-white shadow-lg h-[65px] w-full fixed left-0 ${
          sidebarPosition === 'top' ? 'top-[65px]' : 'bottom-0'
        } z-40 flex items-center justify-center px-4`} //
      >
        <div className="absolute left-4">
          <Link href="/portal-painel"> {/* Link para o painel do corretor */}
            <Image src={logoIconUrl} alt="Logo Studio 57" width={32} height={32} />
          </Link>
        </div>
        <nav className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar py-2"> {/* */}
          {allItems.map((item) => {
            // Adapta a verificação de permissão se necessário, ou remove se não usar recursos
             const canViewItem = true; // Simplificado: corretor vê todos os seus itens
            // const canViewItem = hasPermission(item.recurso, 'pode_ver');
            if (!item || !canViewItem) return null

            return (
              <Tooltip
                key={item.label}
                label={item.label}
                position={sidebarPosition === 'top' ? 'bottom' : 'top'}
              > {/* */}
                <Link
                  href={item.href}
                  target={item.target}
                  rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-center h-12 w-12 text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200" //
                >
                  <FontAwesomeIcon icon={item.icon} className="text-xl" /> {/* */}
                </Link>
              </Tooltip>
            )
          })}
        </nav>
      </aside>
    )
  }

  // Renderização Vertical (esquerda/direita) - Lógica principal do sidebar.js original
  return (
    <aside
      className={`bg-white shadow-lg h-full fixed top-0 z-40 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-[80px]' : 'w-[260px]' // Lógica de colapso
      } ${sidebarPosition === 'left' ? 'left-0' : 'right-0'}`} // Lógica de posição
    >
      <div className="flex items-center justify-center h-[65px] border-b border-gray-200 flex-shrink-0"> {/* */}
        <Link href="/portal-painel"> {/* Link para o painel do corretor */}
          {/* Usa Image em vez de img para otimização do Next.js */}
          <Image
            src={isCollapsed ? logoIconUrl : logoUrl}
            alt="Logo Studio 57"
            width={isCollapsed ? 32 : 150} // Ajusta o tamanho do logo
            height={isCollapsed ? 32 : 40}
            className={`transition-all duration-300 w-auto ${isCollapsed ? 'h-8' : 'h-10'}`} //
            priority // Carrega o logo principal com prioridade
          />
        </Link>
      </div>
      <nav className="mt-4 flex-grow flex flex-col"> {/* */}
        <ul className="overflow-y-auto">
          {navSections.map((section) => {
            const sectionItems = section.items || [] //
            // Adapta a verificação de permissão ou simplifica
            const hasVisibleItems = sectionItems.some(item => true); // Simplificado: corretor vê tudo
            // const hasVisibleItems = sectionItems.some(item => hasPermission(item.recurso, 'pode_ver'));

            if (!hasVisibleItems) return null

            return (
              <li key={section.title} className="mb-2"> {/* */}
                {!isCollapsed && (
                  <h3 className="px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider my-2">
                    {section.title}
                  </h3> // Título da seção
                )}
                {isCollapsed && (
                  <div className="flex justify-center my-4">
                    <div className="w-8 border-t border-gray-200"></div>
                  </div> // Divisor quando colapsado
                )}

                <ul>
                  {sectionItems.map((item) => {
                     const canViewItem = true; // Simplificado
                    // const canViewItem = hasPermission(item.recurso, 'pode_ver');
                    if (!canViewItem) return null

                    return (
                      <li key={item.label}> {/* */}
                        <Tooltip
                          label={item.label}
                          position={sidebarPosition === 'left' ? 'right' : 'left'}
                        > {/* */}
                          <Link
                            href={item.href}
                            target={item.target}
                            rel={
                              item.target === '_blank'
                                ? 'noopener noreferrer'
                                : undefined
                            }
                            className={`flex items-center py-3 text-gray-700 hover:bg-gray-100 transition-colors duration-200 w-full ${
                              isCollapsed ? 'justify-center' : 'px-6' // Ajusta padding/justificação
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={item.icon}
                              className={`flex-shrink-0 ${
                                isCollapsed ? 'text-xl' : 'text-lg w-6' // Ajusta tamanho do ícone
                              }`}
                            />
                            {!isCollapsed && (
                              <span className="ml-4 text-sm font-medium">
                                {item.label}
                              </span> // Exibe o label apenas se não estiver colapsado
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
      {/* Botão de colapsar/expandir, como no original */}
      <div className="border-t border-gray-200 p-2"> {/* */}
        <button
          onClick={toggleSidebar}
          className="w-full h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors" //
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
            } // Ícone muda dependendo do estado e posição
            size="lg"
          />
        </button>
      </div>
    </aside>
  )
}
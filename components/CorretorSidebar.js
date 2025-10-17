// components/CorretorSidebar.js
'use client'
import React, { useState, Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTachometerAlt,
  faUserFriends,
  faTable,
  faFileSignature,
  faBars,
  faTimes,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { useLayout } from '@/contexts/LayoutContext'
import Image from 'next/image'

// Esta é a lista de links que aparecerá no menu do corretor
const menuItems = [
  {
    href: '/portal-painel',
    icon: faTachometerAlt,
    label: 'Painel',
  },
  {
    href: '/clientes',
    icon: faUserFriends,
    label: 'Clientes',
  },
  {
    href: '/tabela-de-vendas',
    icon: faTable,
    label: 'Tabela de Vendas',
  },
  {
    href: '/portal-contratos',
    icon: faFileSignature,
    label: 'Contratos',
  },
]

const CorretorSidebar = () => {
  const pathname = usePathname()
  const { user, sidebarPosition } = useLayout()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openSubmenus, setOpenSubmenus] = useState({})

  const isActive = (href) => {
    return pathname === href
  }

  const toggleSubmenu = (label) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  const renderMenuItem = (item) => {
    const active = isActive(item.href)

    if (item.submenu) {
      const isSubmenuOpen = openSubmenus[item.label]
      return (
        <Fragment key={item.label}>
          <button
            onClick={() => toggleSubmenu(item.label)}
            className={`w-full text-left flex justify-between items-center px-4 py-2 text-sm font-medium rounded-md ${
              active
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <div className="flex items-center">
              <FontAwesomeIcon icon={item.icon} className="w-5 h-5 mr-3" />
              {item.label}
            </div>
            <FontAwesomeIcon
              icon={isSubmenuOpen ? faChevronUp : faChevronDown}
              className="w-4 h-4"
            />
          </button>
          {isSubmenuOpen && (
            <div className="pl-8">
              {item.submenu.map(renderMenuItem)}
            </div>
          )}
        </Fragment>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
          active
            ? 'bg-gray-700 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
      >
        <FontAwesomeIcon icon={item.icon} className="w-5 h-5 mr-3" />
        {item.label}
      </Link>
    )
  }

  // === RENDERIZAÇÃO DO MENU NA LATERAL ===
  // Exatamente como no seu sidebar.js original
  if (sidebarPosition === 'left' || sidebarPosition === 'right') {
    return (
      <aside
        className={`sticky top-0 h-screen bg-gray-800 text-white ${
          sidebarPosition === 'right' ? 'order-last' : ''
        } md:flex flex-col w-64 hidden`}
      >
        <div className="flex items-center justify-center h-20 border-b border-gray-700">
          <Image
            src="/logo.png"
            alt="Logo"
            width={150}
            height={50}
            className="object-contain"
          />
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map(renderMenuItem)}
        </nav>
      </aside>
    )
  }

  // === RENDERIZAÇÃO DO MENU EMBAIXO ===
  // Exatamente como no seu sidebar.js original
  if (sidebarPosition === 'bottom') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 text-white shadow-lg md:hidden">
        <div className="flex justify-around items-center px-4 py-2">
          {menuItems.map((item) => {
            if (item.submenu) return null // Simplificação: sem submenu no modo 'bottom'
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center p-2 rounded-lg ${
                  active
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="w-6 h-6" />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  // Fallback (caso algo dê errado)
  return null
}

export default CorretorSidebar
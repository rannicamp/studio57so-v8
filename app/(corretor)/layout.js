// app/(corretor)/layout.js
'use client'

import { useState } from 'react'
import CorretorSidebar from '@/components/CorretorSidebar'
import CorretorHeader from '@/components/CorretorHeader'
import { useLayout, LayoutProvider } from '@/contexts/LayoutContext'
import { Toaster } from 'sonner'
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'

function CorretorLayoutInner({ children }) {
  const { user, isUserLoading } = useLayout()
  
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [isCollapsed, setIsCollapsed] = useState(false);   // Desktop

  const toggleSidebarMobile = () => setSidebarOpen(!isSidebarOpen);
  const toggleSidebarDesktop = () => setIsCollapsed(!isCollapsed);

  return (
    <EmpreendimentoProvider>
      <Toaster position="top-right" richColors />
      
      {/* Layout Flex Row para garantir Sidebar na esquerda */}
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        
        {/* SIDEBAR */}
        <div className={`
            fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            bg-white border-r border-gray-200 h-full
        `}>
            <CorretorSidebar 
              user={user} 
              isUserLoading={isUserLoading} 
              isCollapsed={isCollapsed} 
              toggleSidebar={toggleSidebarDesktop} 
              onMobileItemClick={() => setSidebarOpen(false)}
            />
        </div>

        {/* OVERLAY MOBILE */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          <CorretorHeader toggleSidebar={toggleSidebarMobile} />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
            {children}
          </main>

        </div>
      </div>
    </EmpreendimentoProvider>
  )
}

export default function CorretorLayout({ children }) {
  return (
    <LayoutProvider>
      <CorretorLayoutInner>{children}</CorretorLayoutInner>
    </LayoutProvider>
  )
}
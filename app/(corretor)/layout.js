// app/(corretor)/layout.js
'use client'

import { useState } from 'react'
import CorretorSidebar from '@/components/CorretorSidebar'
import CotacoesBar from '@/components/CotacoesBar'
import { useLayout, LayoutProvider } from '@/contexts/LayoutContext'
import { Toaster } from 'sonner'
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'

// =================================================================
// 1. COMPONENTE "INTERNO" (O CONSUMIDOR)
// =================================================================
function CorretorLayoutInner({ children }) {
  
  // --- MUDANÇA AQUI ---
  // Agora pegamos o isUserLoading aqui também
  const { user, isUserLoading, mostrarBarraCotacoes } = useLayout()
  // --- FIM DA MUDANÇA ---

  const sidebarPosition = user?.sidebar_position || 'left'
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const getMainContentPadding = () => {
    if (sidebarPosition === 'bottom') return ''; 
    const paddingClass = isCollapsed ? 'pl-[80px]' : 'pl-[260px]';
    const paddingClassRight = isCollapsed ? 'pr-[80px]' : 'pr-[260px]';
    return sidebarPosition === 'left' ? paddingClass : paddingClassRight;
  }

  return (
    <EmpreendimentoProvider>
      <Toaster position="top-right" richColors />
      <div
        className={`flex ${
          sidebarPosition === 'bottom' ? 'flex-col' : 'flex-row'
        } min-h-screen bg-gray-100`}
      >
        
        {/* --- MUDANÇA PRINCIPAL AQUI --- */}
        {/* Passamos o 'user' e 'isUserLoading' como props */}
        <CorretorSidebar 
          user={user} 
          isUserLoading={isUserLoading} 
          isCollapsed={isCollapsed} 
          toggleSidebar={toggleSidebar} 
        />
        {/* --- FIM DA MUDANÇA --- */}


        <div 
          className={`flex-1 flex flex-col transition-all duration-300 ${getMainContentPadding()}`}
        >
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
          
          {mostrarBarraCotacoes && <CotacoesBar />}
        </div>
      </div>
    </EmpreendimentoProvider>
  )
}

// =================================================================
// 2. COMPONENTE "EXTERNO" (O PROVEDOR)
// =================================================================
export default function CorretorLayout({ children }) {
  return (
    <LayoutProvider>
      <CorretorLayoutInner>{children}</CorretorLayoutInner>
    </LayoutProvider>
  )
}
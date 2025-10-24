// app/(corretor)/layout.js
'use client'

import { useState } from 'react'
import CorretorSidebar from '@/components/CorretorSidebar'
// --- MUDANÇA 1: REMOVIDO CotacoesBar ---
import { useLayout, LayoutProvider } from '@/contexts/LayoutContext'
import { Toaster } from 'sonner'
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'

// =================================================================
// 1. COMPONENTE "INTERNO" (O CONSUMIDOR)
// =================================================================
function CorretorLayoutInner({ children }) {
  
  // --- MUDANÇA 2: REMOVIDO 'mostrarBarraCotacoes' ---
  // Pegamos apenas o que o LayoutContext realmente fornece
  const { user, isUserLoading } = useLayout()
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
        
        <CorretorSidebar 
          user={user} 
          isUserLoading={isUserLoading} 
          isCollapsed={isCollapsed} 
          toggleSidebar={toggleSidebar} 
        />

        <div 
          className={`flex-1 flex flex-col transition-all duration-300 ${getMainContentPadding()}`}
        >
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
          
          {/* --- MUDANÇA 3: REMOVIDA a renderização da barra --- */}
          {/* {mostrarBarraCotacoes && <CotacoesBar />} */}
          {/* --- FIM DA MUDANÇA --- */}
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
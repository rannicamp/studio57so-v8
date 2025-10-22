// app/(corretor)/layout.js
'use client'

import { useState } from 'react' // MANTÉM O useState
import CorretorSidebar from '@/components/CorretorSidebar'
import CotacoesBar from '@/components/CotacoesBar'
import { useLayout, LayoutProvider } from '@/contexts/LayoutContext' // Importações corretas
import { Toaster } from 'sonner'
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'

// =================================================================
// 1. COMPONENTE "INTERNO" (O CONSUMIDOR)
// Esta é a parte que CONSOME o contexto (usa useLayout())
// =================================================================
function CorretorLayoutInner({ children }) {
  // AQUI SIM: Estamos "dentro" do Provider, então useLayout() funciona!
  const { user, mostrarBarraCotacoes } = useLayout()
  const sidebarPosition = user?.sidebar_position || 'left'
  
  // O estado de colapso mora aqui, junto com quem o consome
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  // Lógica do padding (como na última versão)
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
        {/* Passamos o estado e a função para a sidebar */}
        <CorretorSidebar 
          isCollapsed={isCollapsed} 
          toggleSidebar={toggleSidebar} 
        />

        {/* Aplicamos o padding dinâmico */}
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
// Este é o export default, e sua ÚNICA função é PROVER o contexto.
// Ele não pode, de jeito nenhum, chamar o useLayout().
// =================================================================
export default function CorretorLayout({ children }) {
  return (
    // Ele "abraça" o componente interno com o Provider
    <LayoutProvider>
      <CorretorLayoutInner>{children}</CorretorLayoutInner>
    </LayoutProvider>
  )
}
// app/(corretor)/layout.js
'use client'

import { useState, useEffect } from 'react' // Adicionado useEffect
import CorretorHeader from '@/components/shared/CorretorHeader';
import CorretorSidebar from '@/components/shared/CorretorSidebar';
import { useLayout, LayoutProvider } from '@/contexts/LayoutContext'
import { Toaster } from 'sonner'
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'
import TermsUpdateEnforcer from '@/components/shared/TermsUpdateEnforcer';
import { createClient } from '@/utils/supabase/client' // Importação do Supabase

function CorretorLayoutInner({ children }) {
  const { user, isUserLoading } = useLayout()
  const supabase = createClient() // Cliente para o rastreador
  
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Mobile

  // Desktop: Se quiser implementar colapso depois, usaremos este estado. 
  // Por enquanto, deixamos ele sempre expandido (false) para simplificar.
  const [isCollapsed, setIsCollapsed] = useState(false);   

  const toggleSidebarMobile = () => setSidebarOpen(!isSidebarOpen);
  const toggleSidebarDesktop = () => setIsCollapsed(!isCollapsed);

  // --- RASTREADOR DE PRESENÇA (NOVO) ---
  // Mantém o status "Online" atualizado enquanto o corretor navega nesta área
  useEffect(() => {
      if (!user?.id) return;

      const updateOnlineStatus = async () => {
          try {
              await supabase
                  .from('usuarios')
                  .update({ ultimo_acesso: new Date().toISOString() })
                  .eq('id', user.id);
          } catch (error) {
              console.error("Erro ao atualizar status online (Corretor):", error);
          }
      };

      // Atualiza assim que entra
      updateOnlineStatus();

      // Atualiza a cada 2 minutos para manter o status "Online"
      const interval = setInterval(updateOnlineStatus, 2 * 60 * 1000);

      return () => clearInterval(interval);
  }, [user?.id, supabase]);
  // -------------------------------------

  return (
    <EmpreendimentoProvider>
      {/* O GUARDIÃO DOS TERMOS (Verifica atualizações automaticamente) */}
      <TermsUpdateEnforcer />

      <Toaster position="top-right" richColors />
      
      {/* Container Principal: Flex Row (Lado a Lado) e Altura Total */}
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        
        {/* === SIDEBAR WRAPPER === 
            Correção: Adicionado 'w-64' e 'shrink-0' para garantir largura fixa no Desktop
        */}
        <div className={`
            fixed inset-y-0 left-0 z-30 
            w-64 shrink-0 bg-white border-r border-gray-200 h-full
            transform transition-transform duration-300 ease-in-out
            lg:translate-x-0 lg:static lg:inset-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <CorretorSidebar 
              user={user} 
              isUserLoading={isUserLoading} 
              isCollapsed={isCollapsed} 
              toggleSidebar={toggleSidebarDesktop} 
              onMobileItemClick={() => setSidebarOpen(false)}
            />
        </div>

        {/* OVERLAY MOBILE (Fundo escuro) */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* CONTEÚDO PRINCIPAL (Cresce para ocupar o resto) */}
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
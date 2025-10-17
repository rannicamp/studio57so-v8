// app/(corretor)/layout.js
'use client'

import CorretorSidebar from '@/components/CorretorSidebar' // Importa o NOVO menu
import Header from '@/components/Header' // Importa o Header existente
import { useLayout } from '@/contexts/LayoutContext' // Importa o Contexto
import { Toaster } from 'sonner' // Para as notificações futuras
import { CotacoesBar } from '@/components/CotacoesBar'

// Este é o "molde" para todas as páginas do Portal do Corretor
export default function CorretorLayout({ children }) {
  // Lê a posição do menu (left, right, bottom) do contexto!
  const { sidebarPosition, mostrarBarraCotacoes } = useLayout()

  return (
    <>
      <Toaster position="top-right" richColors />
      <div
        className={`flex ${
          // Esta linha aplica a classe correta para a posição do menu!
          sidebarPosition === 'bottom' ? 'flex-col' : 'flex-row'
        } min-h-screen bg-gray-100`}
      >
        {/* Renderiza o menu do Corretor */}
        <CorretorSidebar />

        <div className="flex-1 flex flex-col">
          {/* Renderiza o Header normal */}
          <Header />

          {/* O conteúdo da página (ex: /portal-painel, /clientes) */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
          
          {/* Adiciona a barra de cotações, se estiver habilitada */}
          {mostrarBarraCotacoes && <CotacoesBar />}
        </div>
      </div>
    </>
  )
}
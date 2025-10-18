// app/(corretor)/layout.js
'use client'

import CorretorSidebar from '@/components/CorretorSidebar'
import Header from '@/components/Header'
import CotacoesBar from '@/components/CotacoesBar'
import { useLayout } from '@/contexts/LayoutContext'
import { Toaster } from 'sonner'

// AQUI ESTÁ A IMPORTAÇÃO MÁGICA DA CORREÇÃO!
import { EmpreendimentoProvider } from '@/contexts/EmpreendimentoContext'

// Este é o "molde" para todas as páginas do Portal do Corretor
export default function CorretorLayout({ children }) {
  // Lê a posição do menu (left, right, bottom) do contexto!
  const { sidebarPosition, mostrarBarraCotacoes } = useLayout() || {}

  return (
    // AQUI ESTÁ A CORREÇÃO! Envolvemos tudo no EmpreendimentoProvider
    // para que o Header possa usá-lo.
    <EmpreendimentoProvider>
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
          {/* O Header agora vai funcionar! */}
          <Header />

          {/* O conteúdo da página (ex: /portal-painel, /clientes) */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
          
          {/* Adiciona a barra de cotações, se estiver habilitada */}
          {mostrarBarraCotacoes && <CotacoesBar />}
        </div>
      </div>
    </EmpreendimentoProvider>
  )
}
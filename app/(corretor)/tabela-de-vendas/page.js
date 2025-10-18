// app/(corretor)/tabela-de-vendas/page.js
'use client'

// ESTA É A LINHA MÁGICA DA CORREÇÃO!
export const dynamic = 'force-dynamic'

// Precisamos importar o useLayout para usá-lo
import { useLayout } from '@/contexts/LayoutContext'

export default function TabelaVendasCorretor() {
  
  // AQUI ESTÁ A CORREÇÃO DE HOJE!
  // O log de erro mostra que esta página também tenta pegar o 'user'
  // Adicionamos o || {} para segurança durante o build
  const { user } = useLayout() || {}

  return (
    <div>
      <h2 className="text-xl font-semibold">Tabela de Vendas</h2>
      <p>Aqui vamos duplicar a ferramenta de tabela de vendas, mas com a visão do corretor.</p>
    </div>
  )
}
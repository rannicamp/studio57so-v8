// app/(corretor)/tabela-de-vendas/page.js
'use client'

// ESTA É A LINHA MÁGICA DA CORREÇÃO!
export const dynamic = 'force-dynamic'

export default function TabelaVendasCorretor() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Tabela de Vendas</h2>
      <p>Aqui vamos duplicar a ferramenta de tabela de vendas, mas com a visão do corretor.</p>
    </div>
  )
}
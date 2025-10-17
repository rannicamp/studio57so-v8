// app/(corretor)/tabela-de-vendas/page.js
'use client'

export default function TabelaVendasCorretor() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Tabela de Vendas</h2>
      <p>Aqui vamos duplicar a ferramenta de tabela de vendas, mas com a visão do corretor.</p>
      {/* Vamos reutilizar o componente <TabelaVenda /> que já existe,
        passando os filtros corretos para o corretor.
      */}
    </div>
  )
}
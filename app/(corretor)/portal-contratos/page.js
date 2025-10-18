// app/(corretor)/portal-contratos/page.js

// LINHA MOVIDA PARA O TOPO!
export const dynamic = 'force-dynamic'

'use client' // Agora vem depois

export default function ContratosCorretor() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Gerador de Contratos</h2>
      <p>Aqui ficará a lista de contratos gerados pelo corretor e o gerador.</p>
    </div>
  )
}
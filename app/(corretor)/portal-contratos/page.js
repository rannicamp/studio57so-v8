// app/(corretor)/contratos/page.js
'use client'

export default function ContratosCorretor() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Gerador de Contratos</h2>
      <p>Aqui ficará a lista de contratos gerados pelo corretor e o gerador.</p>
      {/* Vamos reutilizar o componente <GeradorContrato />,
        garantindo que ele só possa criar contratos para os clientes do corretor.
      */}
    </div>
  )
}
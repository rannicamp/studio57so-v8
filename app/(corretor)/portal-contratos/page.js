// app/(corretor)/portal-contratos/page.js
'use client' // <--- CORREÇÃO: AGORA É A PRIMEIRA LINHA!

// Agora esta vem depois:
export const dynamic = 'force-dynamic'

// Precisamos importar o useLayout para usá-lo
import { useLayout } from '@/contexts/LayoutContext'

export default function ContratosCorretor() {
  
  // AQUI ESTÁ A CORREÇÃO FINAL PARA ESTE ARQUIVO!
  // O log de erro mostra que esta página é a última a quebrar
  const { user } = useLayout() || {} // <--- ADICIONAMOS O || {}

  return (
    <div>
      <h2 className="text-xl font-semibold">Gerador de Contratos</h2>
      <p>Aqui ficará a lista de contratos gerados pelo corretor e o gerador.</p>
    </div>
  )
}
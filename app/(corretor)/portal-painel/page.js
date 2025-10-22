// app/(corretor)/portal-painel/page.js
'use client'

// ESTA É A LINHA MÁGICA DA CORREÇÃO!
// Ela diz ao Next.js para não pré-renderizar esta página no build.
export const dynamic = 'force-dynamic'

// Precisamos importar o useLayout para usá-lo
import { useLayout } from '@/contexts/LayoutContext'

export default function PainelCorretor() {
  
  // AQUI ESTÁ A CORREÇÃO FINAL!
  // Removemos o || {} porque o useLayout() agora funciona!
  const { user } = useLayout()
  
  return (
    <div>
      <h2 className="text-xl font-semibold">Painel do Corretor</h2>
      <p>Aqui ficará o dashboard de performance do corretor.</p>
    </div>
  )
}
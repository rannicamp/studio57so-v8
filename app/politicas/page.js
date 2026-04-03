// app/politicas/page.js
import { getActivePlatformPolicies } from '@/app/(main)/configuracoes/politicas/actions'
import PoliticasPublicas from '@/components/compliance/PoliticasPublicas'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

export const metadata = {
 title: 'Políticas e Termos | Studio 57',
 description: 'Documentação legal, termos de uso e políticas de privacidade da plataforma Studio 57.'
}

export default async function PublicPoliciesPage() {
 const politicas = await getActivePlatformPolicies()

 return (
 <div className="min-h-screen bg-slate-50 flex flex-col">
 {/* Nav simples pública */}
 <nav className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-50 print:hidden">
 <div className="max-w-7xl mx-auto flex justify-between items-center">
 <Link href="/" className="font-bold text-xl text-slate-900 tracking-tighter">
 STUDIO<span className="text-emerald-600">57</span>
 </Link>
 <Link
 href="/login"
 className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors"
 >
 Acessar Plataforma
 </Link>
 </div>
 </nav>

 <main className="flex-grow py-8">
 <div className="max-w-7xl mx-auto px-4 md:px-6">
 <PoliticasPublicas
 politicas={politicas}
 historico={[]}
 showHistory={false}
 />
 </div>
 </main>

 <footer className="bg-white border-t border-slate-200 py-8 px-6 print:hidden">
 <div className="max-w-7xl mx-auto text-center space-y-4">
 <p className="text-xs text-slate-400">
 &copy; {new Date().getFullYear()} Studio 57. Todos os direitos reservados.
 </p>
 <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
 <span>Segurança</span>
 <span>Privacidade</span>
 <span>Transparência</span>
 </div>
 </div>
 </footer>
 </div>
 )
}

'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function ModuleGuard({ modulo, children }) {
  const { user, hasModuleAccess, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white z-50 fixed inset-0">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Verificando Assinatura...</span>
        </div>
      </div>
    );
  }

  const access = hasModuleAccess ? hasModuleAccess(modulo) : true;

  if (!access) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-800 text-center z-45 fixed inset-0">
        <div className="max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-[#f25a2f]/10 text-[#f25a2f] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-xl font-bold uppercase">{modulo.slice(0, 3)}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Módulo Não Incluso</h2>
          <p className="text-sm text-slate-500 font-light leading-relaxed mb-6">
            O módulo **{modulo.replace('_', ' ').toUpperCase()}** não está incluído no seu plano de assinatura atual. 
            Atualize seu plano para liberar este e outros recursos avançados do Elo 57.
          </p>
          <Link 
            href="/configuracoes/assinatura" 
            className="inline-block px-6 py-2.5 bg-[#f25a2f] hover:bg-[#d84a22] text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm shadow-[#f25a2f]/15"
          >
            Aumentar Meu Plano (Fazer Upgrade)
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

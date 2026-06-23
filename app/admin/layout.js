"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileShield, faUsers, faBuilding, faGauge, faArrowLeft, faBell } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const supabase = createClient();
  const router = useRouter();

  const handleLogoutAdmin = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: faGauge },
    { name: 'Construtor de Notificações', href: '/admin/notificacoes', icon: faBell },
    { name: 'Políticas e Termos', href: '/admin/politicas', icon: faFileShield },
    { name: 'Organizações', href: '/admin/organizacoes', icon: faBuilding },
    { name: 'Usuários', href: '/admin/usuarios', icon: faUsers },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 flex text-gray-800 font-sans">
      {/* Sidebar Exclusiva Admin (Padrão Ouro) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center justify-between border-b border-gray-100 px-6 bg-white sticky top-0 z-10">
          <Link href="/admin" className="flex items-center">
            <img src="/marca/logo-elo57-horizontal.svg" alt="Elo 57" className="h-8 w-auto" />
          </Link>
          <span className="text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded uppercase">
            Admin
          </span>
        </div>

        <div className="py-4 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-6">
            Menu de Controle
          </p>
          <nav className="space-y-0.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 py-3 px-6 transition-all duration-200 border-l-4 ${isActive
                    ? 'bg-blue-50/50 text-blue-700 border-blue-600 font-bold'
                    : 'text-gray-600 border-transparent hover:bg-blue-50 hover:text-blue-700 hover:border-blue-600 font-medium'
                  }`}
                >
                  <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50/30">
          <Link 
            href="/painel" 
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors w-full"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            Sair pro Painel App
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header Admin */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-gray-100 shrink-0">
          <h1 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
            Central de Operações
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <FontAwesomeIcon icon={faUsers} className="text-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-700">Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Área de conteúdo do children */}
        <div className="p-8 flex-grow overflow-auto bg-gray-50/50">
          {children}
        </div>
      </main>
    </div>
  );
}

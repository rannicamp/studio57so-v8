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
 <div className="min-h-screen bg-slate-900 flex text-slate-100 font-sans">
 {/* Sidebar Exclusiva Admin */}
 <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
 <div className="h-16 flex items-center justify-center border-b border-slate-800 px-6">
 <span className="text-xl font-bold tracking-wider text-emerald-400">STUDIO 57</span>
 <span className="ml-2 text-xs font-semibold bg-red-600/20 text-red-400 px-2 py-1 rounded">ADMIN</span>
 </div>

 <div className="p-4">
 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu do Sistema</p>
 <nav className="space-y-1">
 {navigation.map((item) => {
 const isActive = pathname === item.href;
 return (
 <Link
 key={item.name}
 href={item.href}
 className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
 ? 'bg-emerald-500/10 text-emerald-400'
 : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
 }`}
 >
 <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
 {item.name}
 </Link>
 );
 })}
 </nav>
 </div>

 <div className="mt-auto p-4 border-t border-slate-800">
 <Link href="/painel" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full">
 <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
 Sair pro Painel App
 </Link>
 </div>
 </aside>

 {/* Conteúdo Principal */}
 <main className="flex-1 flex flex-col">
 {/* Header Admin */}
 <header className="h-16 flex items-center justify-between px-8 bg-slate-900 border-b border-slate-800">
 <h1 className="text-lg font-semibold text-slate-200">Central de Operações</h1>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
 <FontAwesomeIcon icon={faUsers} className="text-slate-400 w-4 h-4" />
 </div>
 <div className="flex flex-col">
 <span className="text-sm font-medium text-slate-200">Super Admin</span>
 </div>
 </div>
 </div>
 </header>

 <div className="p-8 flex-1 overflow-auto bg-[#0B1120]">
 {children}
 </div>
 </main>
 </div>
 );
}

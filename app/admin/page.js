"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faBuilding, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function AdminDashboardPage() {
 const supabase = createClient();
 const [stats, setStats] = useState({ usuarios: 0, organizacoes: 0 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function fetchStats() {
 setLoading(true);
 try {
 // Como Superadmin, as policys deixam ele contar tudo
 const { count: usersCount } = await supabase
 .from('usuarios')
 .select('*', { count: 'exact', head: true });

 const { count: orgCount } = await supabase
 .from('organizacoes')
 .select('*', { count: 'exact', head: true });

 setStats({
 usuarios: usersCount || 0,
 organizacoes: orgCount || 0
 });
 } catch (error) {
 console.error("Erro ao carregar estatísticas do Admin:", error);
 } finally {
 setLoading(false);
 }
 }

 fetchStats();
 }, [supabase]);

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral do Studio 57</h1>
 <p className="text-slate-400 text-sm mt-1">O seu painel de controle executivo (Backoffice).</p>
 </div>

 {loading ? (
 <div className="flex justify-center items-center py-12">
 <FontAwesomeIcon icon={faSpinner} spin className="text-emerald-500 text-3xl" />
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 {/* Card 1 */}
 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
 <FontAwesomeIcon icon={faUsers} className="text-xl" />
 </div>
 <div>
 <p className="text-sm font-medium text-slate-400">Usuários Ativos</p>
 <p className="text-2xl font-bold text-white">{stats.usuarios}</p>
 </div>
 </div>
 </div>

 {/* Card 2 */}
 <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
 <FontAwesomeIcon icon={faBuilding} className="text-xl" />
 </div>
 <div>
 <p className="text-sm font-medium text-slate-400">Hubs (Organizações)</p>
 <p className="text-2xl font-bold text-white">{stats.organizacoes}</p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

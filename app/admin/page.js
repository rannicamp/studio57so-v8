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
        // Como Superadmin, as policies permitem contar tudo
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
      {/* Cabeçalho do Módulo Padrão Ouro */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-800">Visão Geral do Backoffice</h2>
          </div>
          <p className="text-gray-500 font-medium">Estatísticas globais e controle administrativo do ecossistema Elo 57.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600 text-3xl" />
            <span className="text-sm font-medium text-gray-500">Buscando métricas operacionais...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Card 1: Usuários */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative overflow-hidden">
            {/* Barra viva lateral - Azul Principal */}
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            
            <div className="flex items-center gap-4 pl-2">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <FontAwesomeIcon icon={faUsers} className="text-xl" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Usuários Ativos</p>
                <p className="text-3xl font-extrabold text-gray-800 mt-1">{stats.usuarios}</p>
              </div>
            </div>
          </div>

          {/* Card 2: Organizações */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm relative overflow-hidden">
            {/* Barra viva lateral - Verde Sucesso */}
            <div className="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
            
            <div className="flex items-center gap-4 pl-2">
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <FontAwesomeIcon icon={faBuilding} className="text-xl" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hubs (Organizações)</p>
                <p className="text-3xl font-extrabold text-gray-800 mt-1">{stats.organizacoes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

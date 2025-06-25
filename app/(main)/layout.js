"use client";

import { useState, useEffect } from 'react';
import '../globals.css'; // CORREÇÃO: O caminho foi ajustado de './' para '../'
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { createClient } from '@/utils/supabase/client';

export default function MainAppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function checkAdminStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error } = await supabase
          .from('usuarios')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (userData && userData.is_admin) {
          setIsAdmin(true);
        } else if (error) {
          console.error("Erro ao verificar status de admin:", error);
        }
      }
      setLoadingUser(false);
    }
    checkAdminStatus();
  }, [supabase]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <Sidebar isCollapsed={isCollapsed} isAdmin={isAdmin} />
      <Header isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
        {children}
      </main>
    </div>
  );
}
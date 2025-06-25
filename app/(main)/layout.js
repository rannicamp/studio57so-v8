"use client";

import { useState, useEffect } from 'react';
import '../globals.css';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { createClient } from '@/utils/supabase/client';

export default function MainAppLayout({ children }) {
  // O estado que controla se o menu está recolhido agora vive aqui
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function checkAdminStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        if (userData?.is_admin) {
          setIsAdmin(true);
        }
      }
      setLoadingUser(false);
    }
    checkAdminStatus();
  }, [supabase]);

  // Função para alternar o estado do menu
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
      {/* Passa o estado e a função para o Sidebar */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        toggleSidebar={toggleSidebar} 
        isAdmin={isAdmin} 
      />
      {/* Passa o estado para o Header */}
      <Header isCollapsed={isCollapsed} />
      {/* A margem do conteúdo principal se ajusta dinamicamente */}
      <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
        {children}
      </main>
    </div>
  );
}
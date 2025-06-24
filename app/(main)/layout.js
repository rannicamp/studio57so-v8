"use client";

import { useState, useEffect } from 'react';
import '../globals.css'; 
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { createClient } from '@/utils/supabase/client'; // Importa o cliente Supabase

export default function MainAppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // NOVO: Estado para saber se o usuário é admin
  const [loadingUser, setLoadingUser] = useState(true); // NOVO: Estado de carregamento do usuário
  const supabase = createClient(); // Cria o cliente Supabase

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
  }, [supabase]); // Dependência para re-executar se o cliente Supabase mudar (geralmente não muda)

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (loadingUser) {
    // Pode mostrar um spinner ou tela de carregamento enquanto verifica o status do usuário
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* A Sidebar agora recebe a prop isAdmin */}
      <Sidebar isCollapsed={isCollapsed} isAdmin={isAdmin} />
      
      {/* O Header continua recebendo o estado para saber onde se posicionar
        e a função para o botão funcionar.
      */}
      <Header isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />

      {/* O conteúdo principal continua ajustando sua margem */}
      <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
        {children}
      </main>
    </div>
  );
}
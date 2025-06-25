"use client";

import { useState } from 'react';
import '../globals.css';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Componente interno que usa o contexto de autenticação
function MainLayoutContent({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario, loading } = useAuth(); // Pega a permissão e o status de carregamento do contexto

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Mostra "Carregando..." enquanto as informações de permissão são verificadas
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p>Carregando permissões...</p>
      </div>
    );
  }

  return (
    <div>
      <Sidebar 
        isCollapsed={isCollapsed} 
        toggleSidebar={toggleSidebar} 
        isAdmin={isProprietario} // Passa a permissão correta para a barra lateral
      />
      <Header isCollapsed={isCollapsed} />
      <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
        {children}
      </main>
    </div>
  );
}

// Layout principal que envolve tudo com o provedor de autenticação
export default function MainAppLayout({ children }) {
  return (
    <AuthProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </AuthProvider>
  );
}
"use client";

import { useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext'; // Importa o hook useAuth

function MainLayoutContent({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario } = useAuth(); // Obtém o status de proprietário do contexto de autenticação

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <LayoutProvider>
      <div>
        <Sidebar
          isCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
          isAdmin={isProprietario} // Passa o status de proprietário como prop para o Sidebar
        />
        <Header isCollapsed={isCollapsed} />
        <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
          {children}
        </main>
      </div>
    </LayoutProvider>
  );
}

export default function MainAppLayout({ children }) {
  return (
    <AuthProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </AuthProvider>
  );
}
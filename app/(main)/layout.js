"use client";

import { useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
// Importa o SessionProvider para o Google
import { SessionProvider } from 'next-auth/react';

// Importa o CSS do FontAwesome. É importante que seja importado globalmente.
import '@fortawesome/fontawesome-svg-core/styles.css'; 
// A configuração global para prevenir o FontAwesome de adicionar estilos automaticamente
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false; 


function MainLayoutContent({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario } = useAuth();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <LayoutProvider>
      <EmpreendimentoProvider>
        <div>
          <Sidebar
            isCollapsed={isCollapsed}
            toggleSidebar={toggleSidebar}
            isAdmin={isProprietario}
          />
          <Header isCollapsed={isCollapsed} />
          <main className={`p-6 mt-[65px] transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
            {children}
          </main>
        </div>
      </EmpreendimentoProvider>
    </LayoutProvider>
  );
}

export default function MainAppLayout({ children }) {
  return (
    <AuthProvider>
      {/* O SessionProvider agora envolve o conteúdo principal */}
      <SessionProvider>
        <MainLayoutContent>{children}</MainLayoutContent>
      </SessionProvider>
    </AuthProvider>
  );
}
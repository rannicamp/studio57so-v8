// app/(main)/layout.js
"use client";

import { useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import StellaChat from '../../components/StellaChat'; // Importar o novo componente

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
          {/* Adicionar o componente StellaChat aqui */}
          <StellaChat />
        </div>
      </EmpreendimentoProvider>
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
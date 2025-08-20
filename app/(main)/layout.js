// app/(main)/layout.js
"use client";

import { useState } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import PoliticasModal from '../../components/PoliticasModal';

import '@fortawesome/fontawesome-svg-core/styles.css'; 
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false; 

// REMOVEMOS OS PROVEDORES DAQUI E DEIXAMOS SÓ O LAYOUT VISUAL
export default function MainAppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario } = useAuth();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <LayoutProvider>
      <EmpreendimentoProvider>
        <PoliticasModal />
        
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
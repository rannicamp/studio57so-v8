// Caminho: app/(bim)/layout.js
'use client';

import { Inter } from 'next/font/google';
import { useState } from 'react';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider } from '../../contexts/EmpreendimentoContext';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { Toaster } from 'sonner';
import Sidebar from '@/components/shared/sidebar';
import Header from '@/components/shared/Header';
import ModuleGuard from '@/components/shared/ModuleGuard';

// Importa estilos globais e FontAwesome (igual ao main)
import '../globals.css'; 
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

const inter = Inter({ subsets: ['latin'] });

function BimLayoutContent({ children, isSidebarOpen, setIsSidebarOpen, toggleSidebar }) {
  const { user } = useAuth();
  const sidebarPosition = user?.sidebar_position || 'left';
  
  // Se a barra global estiver posicionada no topo (top), 
  // ela ficará logo abaixo do Header, acumulando 130px (65px Header + 65px Barra)
  const paddingTop = sidebarPosition === 'top' ? '130px' : '65px';

  return (
    <div className={`${inter.className} h-screen w-screen bg-white text-gray-900 flex flex-col overflow-hidden relative`}>
      
      {/* Header Global no Topo */}
      <div className="print:hidden">
        <Header toggleSidebar={toggleSidebar} />
      </div>

      {/* Sidebar Global do Sistema (Menu lateral) */}
      <div className="print:hidden">
        <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      </div>

      {/* Área abaixo do Header */}
      <div 
        className="flex-1 flex overflow-hidden relative"
        style={{ paddingTop }}
      >
        {/* Conteúdo Dinâmico do BIM Manager (Flex Item 2) */}
          <div className="flex-1 h-full relative overflow-hidden transition-all duration-300">
            {/* Toaster para notificações (Sucesso/Erro upload) */}
            <Toaster position="top-right" richColors />
            {/* O conteúdo da página BIM (Visualizadores web GL) */}
            <ModuleGuard modulo="bim">
              {children}
            </ModuleGuard>
          </div>
      </div>

    </div>
  );
}

export default function BimLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  return (
    <AuthProvider>
      <LayoutProvider>
        <EmpreendimentoProvider>
          <BimLayoutContent 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen} 
            toggleSidebar={toggleSidebar}
          >
            {children}
          </BimLayoutContent>
        </EmpreendimentoProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}
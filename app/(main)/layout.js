"use client";

import { useState } from 'react';
// Note que a importação do 'globals.css' foi removida daqui, pois já está no arquivo principal.
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { AuthProvider } from '../../contexts/AuthContext';
import { LayoutProvider } from '../../contexts/LayoutContext';

function MainLayoutContent({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <LayoutProvider>
      <div>
        <Sidebar
          isCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
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
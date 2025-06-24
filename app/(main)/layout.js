"use client";

import { useState } from 'react';
import '../globals.css'; 
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';

export default function MainAppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div>
      {/* A Sidebar continua recebendo o estado de recolhida */}
      <Sidebar isCollapsed={isCollapsed} />
      
      {/* O Header agora também recebe o estado para saber onde se posicionar
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
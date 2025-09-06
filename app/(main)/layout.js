"use client";

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider, useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import PoliticasModal from '../../components/PoliticasModal';
import AtividadeModal from '../../components/AtividadeModal';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

// Componente interno para conter a nova lógica
function MainLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario, sidebarPosition, loading: authLoading } = useAuth(); // Pega a posição do menu
  const { empreendimentos } = useEmpreendimento();

  const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
  const [isLoadingModalData, setIsLoadingModalData] = useState(false);

  const supabase = createClient();

  const fetchModalData = useCallback(async () => {
    setIsLoadingModalData(true);
    const [funcionariosRes, empresasRes] = await Promise.all([
      supabase.from('funcionarios').select('id, full_name').order('full_name'),
      supabase.from('cadastro_empresa').select('id, razao_social').order('razao_social')
    ]);
    setModalData({
      funcionarios: funcionariosRes.data || [],
      empresas: empresasRes.data || []
    });
    setIsLoadingModalData(false);
  }, [supabase]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        fetchModalData();
        setIsGlobalActivityModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchModalData]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Se ainda estiver carregando os dados do usuário, exibe um loader
  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  // LÓGICA PARA AS CLASSES DINÂMICAS DO LAYOUT
  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';
  
  const containerClasses = {
    left: 'flex flex-row',
    right: 'flex flex-row-reverse',
    top: 'flex flex-col',
    bottom: 'flex flex-col-reverse'
  };

  const mainContentMargins = {
    left: isCollapsed ? 'ml-[80px]' : 'ml-[260px]',
    right: isCollapsed ? 'mr-[80px]' : 'mr-[260px]',
    top: 'mt-[65px]', // Altura do Header
    bottom: 'mb-[65px]' // Altura do Sidebar quando está embaixo
  };

  const headerMargins = {
    left: isCollapsed ? 'left-[80px]' : 'left-[260px]',
    right: isCollapsed ? 'right-[80px]' : 'right-[260px]',
    top: 'left-0',
    bottom: 'left-0'
  };

  const finalContainerClass = containerClasses[sidebarPosition] || 'flex flex-row';
  const finalMainContentMargin = mainContentMargins[sidebarPosition] || 'ml-[260px]';
  const finalHeaderMargin = headerMargins[sidebarPosition] || 'left-[260px]';

  return (
    <>
      {isGlobalActivityModalOpen && (
        <AtividadeModal
          isOpen={isGlobalActivityModalOpen}
          onClose={() => setIsGlobalActivityModalOpen(false)}
          onActivityAdded={() => {
            setIsGlobalActivityModalOpen(false);
            toast.success('Atividade rápida criada com sucesso!');
          }}
          activityToEdit={null}
          funcionarios={modalData.funcionarios}
          allEmpreendimentos={empreendimentos}
          allEmpresas={modalData.empresas}
        />
      )}
      
      <div className={finalContainerClass}>
        <Sidebar
          isCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
          isAdmin={isProprietario}
        />
        <div className={`flex-1 ${!isHorizontal ? 'relative' : ''}`}>
            <Header isCollapsed={isCollapsed} headerPositionClass={finalHeaderMargin} />
            <main className={`p-6 transition-all duration-300 ${!isHorizontal ? `mt-[65px] ${finalMainContentMargin}` : 'pt-[85px]'}`}>
                {children}
            </main>
        </div>
      </div>
    </>
  );
}

export default function MainAppLayoutWrapper({ children }) {
  return (
    <LayoutProvider>
      <EmpreendimentoProvider>
        <PoliticasModal />
        <MainLayout>{children}</MainLayout>
      </EmpreendimentoProvider>
    </LayoutProvider>
  );
}
// Local do Arquivo: app/(main)/layout.js

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

// ##### INÍCIO DA CORREÇÃO #####
// 1. REMOVEMOS o import do SessionProvider daqui.
// ##### FIM DA CORREÇÃO #####

import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

function MainLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario, sidebarPosition, loading: authLoading } = useAuth();
  const { empreendimentos } = useEmpreendimento();

  const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
  const [isLoadingModalData, setIsLoadingModalData] = useState(false);

  const supabase = createClient();

  const fetchModalData = useCallback(async () => {
    setIsLoadingModalData(true);
    const [funcionariosRes, empresasRes] = await Promise.all([
      supabase.from('funcionarios').select('id, full_name').order('full_name'),
      supabase.from('cadastro_empresa').select('id, razao_social').order('rao_social')
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
  
  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  const containerClasses = {
    left: 'flex flex-row',
    right: 'flex flex-row-reverse',
    top: 'flex flex-col',
    bottom: 'flex flex-col-reverse'
  };

  const headerMargins = {
    left: isCollapsed ? 'left-[80px] right-0' : 'left-[260px] right-0',
    right: isCollapsed ? 'right-[80px] left-0' : 'right-[260px] left-0',
    top: 'left-0 right-0',
    bottom: 'left-0 right-0'
  };
  
  const mainContentMargins = {
    left: isCollapsed ? 'ml-[80px]' : 'ml-[260px]',
    right: isCollapsed ? 'mr-[80px]' : 'mr-[260px]',
    top: 'mt-[130px]', 
    bottom: 'mb-[65px]'
  };

  const finalContainerClass = containerClasses[sidebarPosition] || 'flex flex-row';
  const finalMainContentMargin = mainContentMargins[sidebarPosition] || mainContentMargins.left;
  const finalHeaderMargin = headerMargins[sidebarPosition] || headerMargins.left;

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
        <div className="flex-1">
            <Header isCollapsed={isCollapsed} headerPositionClass={finalHeaderMargin} />
            <main className={`p-6 transition-all duration-300 mt-[65px] ${finalMainContentMargin}`}>
                {children}
            </main>
        </div>
      </div>
    </>
  );
}

export default function MainAppLayoutWrapper({ children }) {
  return (
    // ##### INÍCIO DA CORREÇÃO #####
    // 2. REMOVEMOS o SessionProvider daqui, pois ele agora está no layout pai.
    <LayoutProvider>
      <EmpreendimentoProvider>
        <PoliticasModal />
        <MainLayout>{children}</MainLayout>
      </EmpreendimentoProvider>
    </LayoutProvider>
    // ##### FIM DA CORREÇÃO #####
  );
}
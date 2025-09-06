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
  
  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  // LÓGICA PARA AS CLASSES DINÂMICAS DO LAYOUT
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
  
  // ***** INÍCIO DA CORREÇÃO *****
  // Ajustamos a margem do conteúdo principal.
  const mainContentMargins = {
    left: isCollapsed ? 'ml-[80px]' : 'ml-[260px]',
    right: isCollapsed ? 'mr-[80px]' : 'mr-[260px]',
    // Se o menu estiver no topo, a margem superior será a altura do Header (65px) + a altura do Sidebar (65px) = 130px.
    top: 'mt-[130px]', 
    // Se o menu estiver embaixo, a margem inferior será a altura do Sidebar.
    bottom: 'mb-[65px]'
  };
  // ***** FIM DA CORREÇÃO *****

  const finalContainerClass = containerClasses[sidebarPosition] || 'flex flex-row';
  // A margem do conteúdo principal agora é calculada corretamente para todas as posições.
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
        {/* O container do Header e Main foi simplificado */}
        <div className="flex-1">
            <Header isCollapsed={isCollapsed} headerPositionClass={finalHeaderMargin} />
            {/* A margem superior fixa de 65px é para o Header.
              A classe 'finalMainContentMargin' adiciona as margens específicas para a posição do Sidebar.
            */}
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
    <LayoutProvider>
      <EmpreendimentoProvider>
        <PoliticasModal />
        <MainLayout>{children}</MainLayout>
      </EmpreendimentoProvider>
    </LayoutProvider>
  );
}
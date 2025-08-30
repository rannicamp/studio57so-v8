// app/(main)/layout.js
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
  const { isProprietario } = useAuth();
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
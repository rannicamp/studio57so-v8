// app/(main)/layout.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider, useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import PoliticasModal from '../../components/PoliticasModal';
import AtividadeModal from '../../components/AtividadeModal'; // Importando o modal de atividade
import { createClient } from '../../utils/supabase/client'; // Importando o Supabase client
import { toast } from 'sonner'; // Importando o toast para feedback

import '@fortawesome/fontawesome-svg-core/styles.css'; 
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false; 

// Componente interno para conter a nova lógica
function MainLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isProprietario } = useAuth();
  const { empreendimentos } = useEmpreendimento(); // Pegando a lista de empreendimentos do contexto

  // Estados para o modal global
  const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
  const [isLoadingModalData, setIsLoadingModalData] = useState(false);

  const supabase = createClient();

  // Função para buscar os dados necessários para o modal (funcionários e empresas)
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

  // Efeito que "ouve" o atalho do teclado (Ctrl + A)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Verifica se Ctrl (ou Command no Mac) e a tecla 'A' foram pressionados
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); // Impede a ação padrão do navegador (selecionar tudo)
        fetchModalData(); // Busca os dados mais recentes para o modal
        setIsGlobalActivityModalOpen(true); // Abre o modal
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Limpa o "ouvinte" quando o componente é desmontado para evitar problemas
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchModalData]); // Adicionamos fetchModalData como dependência

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* O modal de atividade agora vive aqui, no layout principal */}
      {isGlobalActivityModalOpen && (
        <AtividadeModal
          isOpen={isGlobalActivityModalOpen}
          onClose={() => setIsGlobalActivityModalOpen(false)}
          onActivityAdded={() => {
            setIsGlobalActivityModalOpen(false);
            toast.success('Atividade rápida criada com sucesso!');
            // Não fazemos um refresh global para não atrapalhar o usuário
          }}
          activityToEdit={null} // Sempre para uma nova atividade
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
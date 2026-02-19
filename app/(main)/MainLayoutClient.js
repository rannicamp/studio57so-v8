"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/shared/sidebar';
import Header from '@/components/shared/Header';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider, useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import PoliticasModal from '../../components/configuracoes/PoliticasModal';
import AtividadeModal from '../../components/atividades/AtividadeModal';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

function MainLayoutContent({ children }) {
    const pathname = usePathname();
    const isCaixaDeEntrada = pathname === '/caixa-de-entrada';

    // ##### MEMÓRIA DA INTERFACE (ESTILO BIM) #####
    // Tentamos buscar no navegador se o menu estava aberto antes
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('s57_sidebar_state');
            return saved === 'true';
        }
        return false;
    });

    const { user, isProprietario, loading: authLoading, organizacao_id } = useAuth();
    const sidebarPosition = user?.sidebar_position || 'left';
    
    // Referência para evitar o "piscar" do carregamento se o usuário já estiver na tela
    const hasLoadedOnce = useRef(false);
    if (user && !authLoading) {
        hasLoadedOnce.current = true;
    }

    const { empreendimentos } = useEmpreendimento();
    const router = useRouter();

    const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
    const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);

    const supabase = createClient();
    const isCotacoesBarVisible = user?.mostrar_barra_cotacoes && user?.cotacoes_visiveis?.length > 0;

    // Persiste a escolha do menu lateral para não fechar sozinho
    useEffect(() => {
        localStorage.setItem('s57_sidebar_state', isSidebarOpen);
    }, [isSidebarOpen]);

    // Rastreamento de Presença
    useEffect(() => {
        if (!user?.id) return;
        const updateOnlineStatus = async () => {
            try {
                await supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id);
            } catch (error) { /* Silencioso */ }
        };
        updateOnlineStatus();
        const interval = setInterval(updateOnlineStatus, 3 * 60 * 1000); // 3 min
        return () => clearInterval(interval);
    }, [user?.id, supabase]);

    // Verificação de Sessão
    useEffect(() => {
        if (!authLoading && !user && hasLoadedOnce.current) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fetchModalData = useCallback(async () => {
        if (!organizacao_id) return;
        setIsLoadingModalData(true);
        const [funcRes, empRes] = await Promise.all([
            supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacao_id).order('full_name'),
            supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacao_id).order('razao_social')
        ]);
        setModalData({ funcionarios: funcRes.data || [], empresas: empRes.data || [] });
        setIsLoadingModalData(false);
    }, [supabase, organizacao_id]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                event.preventDefault();
                fetchModalData();
                setIsGlobalActivityModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fetchModalData]);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const closeSidebar = () => setIsSidebarOpen(false);
    
    if (authLoading && !hasLoadedOnce.current) {
        return <div className="flex items-center justify-center h-screen bg-white">Carregando...</div>;
    }

    if (!user && !authLoading) return null;

    // --- LÓGICA DE LAYOUT CORRIGIDA PELO DEVONILDO ---
    const isLateral = sidebarPosition === 'left' || sidebarPosition === 'right';
    
    const mainStyles = (() => {
        // Altura do cabeçalho calculada dinamicamente
        const topPadding = isCotacoesBarVisible ? '89px' : '65px';

        if (isCaixaDeEntrada) {
            // AQUI ESTAVA O PROBLEMA! O layout ignorava o Header na Caixa de Entrada.
            // Agora garantimos que o conteúdo seja empurrado para baixo dele.
            return { paddingTop: topPadding };
        }
        if (isLateral) {
            return {
                paddingTop: topPadding,
                paddingBottom: '20px',
                width: '100%'
            };
        } else if (sidebarPosition === 'top') {
            return { paddingTop: '140px', paddingBottom: '20px' };
        } else { 
            return { paddingTop: '80px', paddingBottom: '80px' };
        }
    })();

    const content = (
        <>
            <Header toggleSidebar={toggleSidebar} />
            <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} isAdmin={isProprietario} />
            
            <main 
                className={`${isCaixaDeEntrada ? 'flex-1 w-full relative overflow-hidden flex flex-col' : 'flex-grow p-4 transition-all duration-300'}`}
                style={mainStyles}
            >
                <div className={isCaixaDeEntrada ? "h-full w-full" : "w-full"}>
                    {children}
                </div>
            </main>

            {isGlobalActivityModalOpen && (
                <AtividadeModal 
                    isOpen={isGlobalActivityModalOpen} 
                    onClose={() => setIsGlobalActivityModalOpen(false)} 
                    onActivityAdded={() => { setIsGlobalActivityModalOpen(false); toast.success('Atividade rápida criada!'); }} 
                    funcionarios={modalData.funcionarios} 
                    allEmpreendimentos={empreendimentos} 
                    allEmpresas={modalData.empresas} 
                /> 
            )}
        </>
    );

    return (
        <div className={isCaixaDeEntrada ? "flex flex-col h-screen w-full bg-white overflow-hidden" : "min-h-screen bg-white flex flex-col"}>
            {content}
        </div>
    );
}

export default function MainLayoutClient({ children }) {
    return (
        <LayoutProvider>
            <EmpreendimentoProvider>
                <PoliticasModal />
                <MainLayoutContent>{children}</MainLayoutContent>
            </EmpreendimentoProvider>
        </LayoutProvider>
    );
}
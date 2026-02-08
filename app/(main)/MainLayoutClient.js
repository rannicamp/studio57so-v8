"use client";

import { useState, useEffect, useCallback } from 'react';
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

    // ESTADO: Menu Gaveta (Padrão Fechado)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const { user, isProprietario, loading: authLoading, organizacao_id } = useAuth();
    const sidebarPosition = user?.sidebar_position || 'left';
    
    const { empreendimentos } = useEmpreendimento();
    const router = useRouter();

    const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
    const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);

    const supabase = createClient();
    
    const isCotacoesBarVisible = user?.mostrar_barra_cotacoes && user?.cotacoes_visiveis?.length > 0;

    // Rastreamento de Presença
    useEffect(() => {
        if (!user?.id) return;
        const updateOnlineStatus = async () => {
            try {
                await supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id);
            } catch (error) { console.error("Erro status online:", error); }
        };
        updateOnlineStatus();
        const interval = setInterval(updateOnlineStatus, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user?.id, supabase]);

    // Verificação de Sessão
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    // Busca de Dados para Modal Global (Ctrl+A)
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

    // --- CONTROLE DO MENU ---
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);
    
    if (authLoading || !user) return <div className="flex items-center justify-center h-screen bg-white">Carregando...</div>;

    // --- LÓGICA DE LAYOUT ---
    
    // 1. Layout para CAIXA DE ENTRADA (Tela Cheia, Sem Scroll Geral)
    if (isCaixaDeEntrada) {
        return (
            <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
                {/* Header Fixo (z-40) */}
                <Header toggleSidebar={toggleSidebar} />

                {/* Sidebar Overlay (z-50) */}
                <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} isAdmin={isProprietario} />

                {/* Conteúdo Principal */}
                <main className={`flex-1 w-full relative overflow-hidden flex flex-col ${isCotacoesBarVisible ? 'pt-[89px]' : 'pt-[65px]'}`}>
                    {children}
                </main>
            </div>
        );
    }

    // 2. Layout PADRÃO (Com Scroll na Página)
    const isLateral = sidebarPosition === 'left' || sidebarPosition === 'right';
    
    const mainStyles = (() => {
        if (isLateral) {
            // Menu Lateral (Gaveta): Sem margens laterais, apenas padding topo para o header
            return {
                paddingTop: isCotacoesBarVisible ? '89px' : '65px',
                paddingBottom: '20px',
                width: '100%'
            };
        } else if (sidebarPosition === 'top') {
            // Menu Topo: Header + Menu ocupam espaço no topo
            return { paddingTop: '140px', paddingBottom: '20px' };
        } else { 
            // Menu Fundo: Header no topo, Menu no fundo
            return { paddingTop: '80px', paddingBottom: '80px' };
        }
    })();

    // Se for Top/Bottom, o header precisa de margem 0. Se for lateral, também.
    const headerMargins = { left: '', right: '', top: '', bottom: '' };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Header toggleSidebar={toggleSidebar} headerPositionClass={headerMargins[sidebarPosition]} />

            <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} isAdmin={isProprietario} />

            <main 
                // MUDANÇA 1: Reduzi o padding de p-6 para p-4 para ganhar mais espaço
                className="flex-grow p-4 transition-all duration-300"
                style={mainStyles}
            >
                {/* MUDANÇA 2: Removi 'max-w-[1600px] mx-auto' e coloquei 'w-full' */}
                {/* Agora o sistema vai esticar até o limite da tela */}
                <div className="w-full">
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
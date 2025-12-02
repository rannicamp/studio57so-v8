// app/(main)/layout.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../../components/sidebar';
import Header from '../../components/Header';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { EmpreendimentoProvider, useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useAuth } from '../../contexts/AuthContext';
import PoliticasModal from '../../components/PoliticasModal';
import AtividadeModal from '../../components/atividades/AtividadeModal';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

function MainLayout({ children }) {
    const pathname = usePathname();
    const isCaixaDeEntrada = pathname === '/caixa-de-entrada';

    const [isCollapsed, setIsCollapsed] = useState(false);
    
    const { user, isProprietario, loading: authLoading, organizacao_id } = useAuth();
    const sidebarPosition = user?.sidebar_position || 'left';
    
    const { empreendimentos } = useEmpreendimento();
    const router = useRouter();

    const [isGlobalActivityModalOpen, setIsGlobalActivityModalOpen] = useState(false);
    const [modalData, setModalData] = useState({ funcionarios: [], empresas: [] });
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);

    const supabase = createClient();
    
    const isCotacoesBarVisible = user?.mostrar_barra_cotacoes && user?.cotacoes_visiveis?.length > 0;

    useEffect(() => {
        if (!authLoading && !user) {
            console.error("Sessão fantasma detectada no layout! Forçando logout.");
            supabase.auth.signOut();
            router.push('/login?error=Sua sessão é inválida ou expirou.');
        }
    }, [authLoading, user, router, supabase]);

    const fetchModalData = useCallback(async () => {
        if (!organizacao_id) return;
        setIsLoadingModalData(true);
        const [funcionariosRes, empresasRes] = await Promise.all([
            supabase.from('funcionarios').select('id, full_name').eq('organizacao_id', organizacao_id).order('full_name'),
            supabase.from('cadastro_empresa').select('id, razao_social').eq('organizacao_id', organizacao_id).order('razao_social')
        ]);
        setModalData({
            funcionarios: funcionariosRes.data || [],
            empresas: empresasRes.data || []
        });
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
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [fetchModalData]);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);
    
    if (authLoading || !user) {
        return <div className="flex items-center justify-center h-screen bg-gray-100">Carregando sistema...</div>;
    }

    const containerClasses = { left: 'flex flex-row', right: 'flex flex-row-reverse', top: 'flex flex-col', bottom: 'flex flex-col-reverse' };
    const headerMargins = { left: isCollapsed ? 'left-[80px] right-0' : 'left-[260px] right-0', right: isCollapsed ? 'right-[80px] left-0' : 'right-[260px] left-0', top: 'left-0 right-0', bottom: 'left-0 right-0' };
    const mainContentMargins = { left: isCollapsed ? 'ml-[80px]' : 'ml-[260px]', right: isCollapsed ? 'mr-[80px]' : 'mr-[260px]', top: 'mt-[130px]', bottom: 'mb-[65px]' };
    
    const finalContainerClass = containerClasses[sidebarPosition] || 'flex flex-row';
    const finalMainContentMargin = mainContentMargins[sidebarPosition] || mainContentMargins.left;
    const finalHeaderMargin = headerMargins[sidebarPosition] || headerMargins.left;

    // Layout Específico da Caixa de Entrada
    const layoutCaixaDeEntrada = (
        <div className={`${finalContainerClass} h-screen w-full bg-gray-100 overflow-hidden`}>
            {/* CORREÇÃO: Esconde Sidebar na impressão */}
            <div className="print:hidden">
                <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} isAdmin={isProprietario}/>
            </div>
            
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* CORREÇÃO: Esconde Header na impressão */}
                <div className="flex-shrink-0 print:hidden">
                    <Header />
                </div>
                {/* CORREÇÃO: Reseta overflow na impressão */}
                <main className="flex-grow min-h-0 print:overflow-visible print:h-auto"> 
                    {children}
                </main>
            </div>
        </div>
    );

    // Layout Padrão (Usado no RDO)
    const layoutPadrao = (
        <div className={finalContainerClass}>
            {/* CORREÇÃO: Esconde Sidebar na impressão */}
            <div className="print:hidden">
                <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} isAdmin={isProprietario}/>
            </div>

            <div className="flex-1">
                {/* CORREÇÃO: Esconde Header na impressão */}
                <div className="print:hidden">
                    <Header headerPositionClass={finalHeaderMargin} />
                </div>

                {/* CORREÇÃO FINAL: 
                    print:!m-0 -> Remove a margem lateral (do menu)
                    print:!mt-0 -> Remove a margem superior (do header)
                    print:w-full -> Força largura total
                */}
                <main className={`transition-all duration-300 ${isCotacoesBarVisible ? 'mt-[89px]' : 'mt-[65px]'} ${finalMainContentMargin} print:!m-0 print:!p-0 print:w-full`}>
                    {children}
                </main>
            </div>
        </div>
    );

    return (
        <>
            {isGlobalActivityModalOpen && ( <AtividadeModal isOpen={isGlobalActivityModalOpen} onClose={() => setIsGlobalActivityModalOpen(false)} onActivityAdded={() => { setIsGlobalActivityModalOpen(false); toast.success('Atividade rápida criada com sucesso!'); }} activityToEdit={null} funcionarios={modalData.funcionarios} allEmpreendimentos={empreendimentos} allEmpresas={modalData.empresas} /> )}
            {isCaixaDeEntrada ? layoutCaixaDeEntrada : layoutPadrao}
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
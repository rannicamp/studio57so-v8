'use client'

import { useState, useEffect } from 'react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import EmailInbox from '@/components/email/EmailInbox';
import { useAuth } from '@/contexts/AuthContext';

// CHAVE DE CACHE APENAS DA NAVEGAÇÃO
const INBOX_NAV_STATE_KEY = 'inboxNavState';

export default function CaixaDeEntrada() {
    const { hasPermission, loading } = useAuth();
    
    // Define se o usuário tem permissão para ver o WhatsApp
    const canViewWhatsapp = hasPermission('caixa_de_entrada', 'pode_ver');

    // Estado inicial
    const [activeTab, setActiveTab] = useState('email');

    useEffect(() => {
        if (typeof window !== 'undefined' && !loading) {
            const cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
            
            if (canViewWhatsapp) {
                if (cached) {
                    setActiveTab(cached);
                } else {
                    setActiveTab('whatsapp');
                }
            } else {
                setActiveTab('email');
            }
        }
    }, [canViewWhatsapp, loading]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            localStorage.setItem(INBOX_NAV_STATE_KEY, tab);
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">Carregando permissões...</div>;
    }

    /* CORREÇÃO AQUI: 
       Removemos 'fixed', 'top-16', 'bottom-88', 'calc(100vh)'.
       O MainLayoutClient já configurou o container pai com flex-col e h-screen.
       Aqui só precisamos dizer: "Ocupe 100% da altura e largura disponível".
    */
    return (
        <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
            {/* Renderiza WhatsApp APENAS se estiver na aba E tiver permissão */}
            {activeTab === 'whatsapp' && canViewWhatsapp ? (
                <WhatsAppInbox onChangeTab={handleTabChange} />
            ) : (
                <EmailInbox onChangeTab={handleTabChange} canViewWhatsapp={canViewWhatsapp} />
            )}
        </div>
    );
}
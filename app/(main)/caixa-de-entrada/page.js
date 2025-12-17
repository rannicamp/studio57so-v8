'use client'

import { useState, useEffect } from 'react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import EmailInbox from '@/components/email/EmailInbox';
import { useAuth } from '@/contexts/AuthContext';

// CHAVE DE CACHE APENAS DA NAVEGAÇÃO
const INBOX_NAV_STATE_KEY = 'inboxNavState';

export default function CaixaDeEntrada() {
    const { hasPermission, loading } = useAuth();
    
    // Define se o usuário tem permissão para ver o WhatsApp (usando o recurso 'caixa_de_entrada')
    // Se não tiver, ele só verá o e-mail.
    const canViewWhatsapp = hasPermission('caixa_de_entrada', 'pode_ver');

    // Estado inicial seguro: se não sabemos ainda, ou se não pode ver whats, começa no email
    const [activeTab, setActiveTab] = useState('email');

    useEffect(() => {
        if (typeof window !== 'undefined' && !loading) {
            const cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
            
            // Se o usuário TEM permissão para WhatsApp
            if (canViewWhatsapp) {
                // Se tinha algo no cache, respeita (pode ser 'whatsapp' ou 'email')
                if (cached) {
                    setActiveTab(cached);
                } else {
                    // Padrão para quem tem acesso total: WhatsApp
                    setActiveTab('whatsapp');
                }
            } else {
                // Se NÃO tem permissão, força E-mail sempre
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
        return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-500">Carregando permissões...</div>;
    }

    return (
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-64px)] md:pb-20
        ">
            {/* Renderiza WhatsApp APENAS se estiver na aba E tiver permissão */}
            {activeTab === 'whatsapp' && canViewWhatsapp ? (
                <WhatsAppInbox onChangeTab={handleTabChange} />
            ) : (
                // Passamos a prop canViewWhatsapp para o EmailInbox saber se mostra o botão de voltar pro Zap
                <EmailInbox onChangeTab={handleTabChange} canViewWhatsapp={canViewWhatsapp} />
            )}
        </div>
    );
}
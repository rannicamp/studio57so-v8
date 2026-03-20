'use client'

import { useState, useEffect } from 'react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import EmailInbox from '@/components/email/EmailInbox';
import InstagramInbox from '@/components/instagram/InstagramInbox';
import { useAuth } from '@/contexts/AuthContext';

const INBOX_NAV_STATE_KEY = 'inboxNavState';

export default function CaixaDeEntrada() {
    const { hasPermission, loading } = useAuth();
    const canViewWhatsapp = hasPermission('caixa_de_entrada', 'pode_ver');
    const [activeTab, setActiveTab] = useState('email');

    useEffect(() => {
        if (typeof window !== 'undefined' && !loading) {
            const cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
            if (canViewWhatsapp) {
                setActiveTab(cached || 'whatsapp');
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

    return (
        <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
            {activeTab === 'whatsapp' && canViewWhatsapp ? (
                <WhatsAppInbox onChangeTab={handleTabChange} />
            ) : activeTab === 'instagram' && canViewWhatsapp ? (
                <InstagramInbox onChangeTab={handleTabChange} />
            ) : (
                <EmailInbox onChangeTab={handleTabChange} canViewWhatsapp={canViewWhatsapp} />
            )}
        </div>
    );
}
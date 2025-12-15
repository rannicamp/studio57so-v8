'use client'

import { useState, useEffect } from 'react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import EmailInbox from '@/components/email/EmailInbox';

// CHAVE DE CACHE APENAS DA NAVEGAÇÃO
const INBOX_NAV_STATE_KEY = 'inboxNavState';

export default function CaixaDeEntrada() {
    // Recupera a aba ativa
    const [activeTab, setActiveTab] = useState('whatsapp');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
            if (cached) setActiveTab(cached);
        }
    }, []);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            localStorage.setItem(INBOX_NAV_STATE_KEY, tab);
        }
    };

    return (
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-64px)] md:pb-20
        ">
            {activeTab === 'whatsapp' ? (
                <WhatsAppInbox onChangeTab={handleTabChange} />
            ) : (
                <EmailInbox onChangeTab={handleTabChange} />
            )}
        </div>
    );
}
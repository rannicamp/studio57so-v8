'use client'
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';
import EmailInbox from '@/components/email/EmailInbox';
import InstagramInbox from '@/components/instagram/InstagramInbox';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';

const INBOX_NAV_STATE_KEY = 'inboxNavState';

function CaixaDeEntradaClient() {
 const { hasPermission, loading } = useAuth();
 const canViewWhatsapp = hasPermission('caixa_de_entrada', 'pode_ver');
 const searchParams = useSearchParams();
 const targetContato = searchParams.get('contato');

 // Começa como null para evitar mismatch de hidratação server/client no Next.js
 const [activeTab, setActiveTab] = useState(null);

 useEffect(() => {
 if (typeof window === 'undefined' || loading) return;
 // Se houver parâmetro de redirecionamento, forçamos a aba para WhatsApp automaticamente
 if (targetContato && canViewWhatsapp) {
 setActiveTab('whatsapp');
 return;
 }

 const cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
 if (canViewWhatsapp) {
 setActiveTab(cached || 'whatsapp');
 } else {
 setActiveTab('email');
 }
 }, [canViewWhatsapp, loading, targetContato]);

 const handleTabChange = (tab) => {
 setActiveTab(tab);
 if (typeof window !== 'undefined') {
 localStorage.setItem(INBOX_NAV_STATE_KEY, tab);
 }
 };

 if (loading || activeTab === null) {
 return <div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">Carregando...</div>;
 }

 return (
 <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
 {activeTab === 'whatsapp' && canViewWhatsapp ? (
 // Passamos o targetContato para o WhatsAppInbox saber que deve forçar foco nele
 <WhatsAppInbox onChangeTab={handleTabChange} initialContactId={targetContato} />
 ) : activeTab === 'instagram' && canViewWhatsapp ? (
 <InstagramInbox onChangeTab={handleTabChange} />
 ) : (
 <EmailInbox onChangeTab={handleTabChange} canViewWhatsapp={canViewWhatsapp} />
 )}
 </div>
 );
}

export default function CaixaDeEntrada() {
 return (
 <Suspense fallback={<div className="flex h-full items-center justify-center bg-gray-100 text-gray-500">Carregando Inbox...</div>}>
 <CaixaDeEntradaClient />
 </Suspense>
 );
}
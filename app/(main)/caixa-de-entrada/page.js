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
  const { hasPermission, loading, user } = useAuth();
  const canViewWhatsapp = hasPermission('caixa_de_entrada', 'pode_ver');
  const searchParams = useSearchParams();
  const targetContato = searchParams.get('contato');

  const organizacaoId = user?.organizacao_id;
  const isOrg2 = organizacaoId === 2;

  // Começa como null para evitar mismatch de hidratação server/client no Next.js
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    
    // Se houver parâmetro de redirecionamento, forçamos a aba para WhatsApp automaticamente
    if (targetContato && canViewWhatsapp) {
      setActiveTab('whatsapp');
      return;
    }

    let cached = localStorage.getItem(INBOX_NAV_STATE_KEY);
    
    // Proteção extra: se a aba em cache for instagram mas não for a Org 2, força para WhatsApp
    if (cached === 'instagram' && !isOrg2) {
      cached = 'whatsapp';
    }

    if (canViewWhatsapp) {
      setActiveTab(cached || 'whatsapp');
    } else {
      setActiveTab('email');
    }
  }, [canViewWhatsapp, loading, targetContato, isOrg2]);

  const handleTabChange = (tab) => {
    // Bloqueia mudança de aba para o Instagram para quem não é da Organização 2
    if (tab === 'instagram' && !isOrg2) {
      return;
    }
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
        <WhatsAppInbox onChangeTab={handleTabChange} initialContactId={targetContato} />
      ) : activeTab === 'instagram' && canViewWhatsapp && isOrg2 ? (
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
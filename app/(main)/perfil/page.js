// app/(main)/perfil/page.js
'use client';

import { useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext';
import ProfileForm from '@/components/ProfileForm';
import ConfiguracaoNotificacoes from '@/components/notificacao/ConfiguracaoNotificacoes';

export default function PerfilPage() {
    const { setPageTitle } = useLayout();
    const { user } = useAuth();

    useEffect(() => {
        setPageTitle('Meu Perfil');
    }, [setPageTitle]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {/* Seção 1: Dados Pessoais (Existente) */}
            <section>
                <ProfileForm />
            </section>

            {/* Seção 2: Notificações (Nova) */}
            <section>
                <ConfiguracaoNotificacoes userId={user?.id} />
            </section>
        </div>
    );
}
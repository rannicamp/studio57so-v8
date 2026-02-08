'use client';

import { useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import ProfileForm from '@/components/ProfileForm';
import PreferenciasInterface from '@/components/perfil/PreferenciasInterface'; // <--- Importe aqui
import MinhasNotificacoes from '@/components/perfil/MinhasNotificacoes';

export default function PerfilPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle('Meu Perfil');
    }, [setPageTitle]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {/* 1. Dados Pessoais */}
            <section>
                <ProfileForm />
            </section>

            {/* 2. Preferências de Interface (NOVO) */}
            <section id="aparencia">
                <PreferenciasInterface />
            </section>

            {/* 3. Notificações */}
            <section id="notificacoes">
                <MinhasNotificacoes />
            </section>
        </div>
    );
}
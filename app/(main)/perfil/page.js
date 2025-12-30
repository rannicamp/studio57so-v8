'use client';

import { useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { useAuth } from '@/contexts/AuthContext'; // Mantido caso precise no futuro
import ProfileForm from '@/components/ProfileForm';
// Importamos o novo componente que se conecta à tabela de regras
import MinhasNotificacoes from '@/components/perfil/MinhasNotificacoes';

export default function PerfilPage() {
    const { setPageTitle } = useLayout();
    // const { user } = useAuth(); // O componente MinhasNotificacoes já busca o usuário internamente

    useEffect(() => {
        setPageTitle('Meu Perfil');
    }, [setPageTitle]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {/* Seção 1: Dados Pessoais (Avatar, Nome, Senha) */}
            <section>
                <ProfileForm />
            </section>

            {/* Seção 2: Preferências de Notificação (Novo Sistema Dinâmico) */}
            <section id="notificacoes">
                <MinhasNotificacoes />
            </section>
        </div>
    );
}
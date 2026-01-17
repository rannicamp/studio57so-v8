//app\(main)\layout.js
import { createClient } from '../../utils/supabase/server';
import { redirect } from 'next/navigation';
import MainLayoutClient from './MainLayoutClient';

export default async function MainLayout({ children }) {
    // AWAIT AGORA É OBRIGATÓRIO (Fix Next.js 15)
    const supabase = await createClient();
    
    // Verificação de segurança no servidor (mais rápida e segura)
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Se passou, renderiza o cliente com todo o conteúdo visual
    return <MainLayoutClient>{children}</MainLayoutClient>;
}
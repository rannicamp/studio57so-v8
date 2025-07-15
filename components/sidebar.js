// app/(main)/crm/page.js

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';
import CrmPage from './CrmPage'; // Vamos criar este componente cliente

export default async function Page() {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();

    // Busca os contatos que podem ser usados tanto no Chat quanto no CRM
    const { data: contatos, error: contatosError } = await supabase
        .from('contatos')
        .select(`
            *,
            telefones (id, telefone, tipo),
            emails (id, email, tipo)
        `);

    if (contatosError) {
        console.error("Erro ao buscar contatos para a página de CRM:", contatosError);
        // Tratar o erro adequadamente, talvez mostrando uma mensagem na UI
    }

    return (
        <CrmPage
            contatos={contatos || []}
            user={user}
        />
    );
}
// app/(main)/configuracoes/integracoes/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IntegrationsManager from '../../../../components/configuracoes/IntegrationsManager';
import { getOrganizationId } from '@/utils/getOrganizationId';

export default async function IntegracoesPage() {
    const supabase = await createClient();

    // 1. Proteção de Rota
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // 2. Busca a organização
    const organizacaoId = await getOrganizationId(user.id);
    
    if (!organizacaoId) {
        return (
            <div className="p-4 text-center text-red-600">
                Erro: Organização do usuário não encontrada. Contate o suporte.
            </div>
        );
    }

    // 3. SAAS: Busca Integração Meta (Facebook/Instagram)
    const { data: metaIntegration } = await supabase
        .from('integracoes_meta')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single(); // Traz apenas 1 ou null

    // 4. SAAS: Busca Integração Google
    const { data: googleIntegration } = await supabase
        .from('integracoes_google')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    // 5. Mantemos o WhatsApp Legacy (por enquanto)
    const { data: whatsappConfig } = await supabase
        .from('configuracoes_whatsapp')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .single();

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex flex-col gap-2">
                <Link href="/configuracoes" className="text-gray-500 hover:text-primary mb-2 inline-flex items-center gap-2 transition-colors">
                    &larr; Voltar para Configurações
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Central de Integrações</h1>
                <p className="text-gray-600 max-w-2xl">
                    Conecte o Elo 57 às suas ferramentas favoritas de Marketing e Vendas. 
                    Gerencie suas conexões com Facebook, Instagram, Google e WhatsApp em um só lugar.
                </p>
            </div>

            <div className="mt-8">
                {/* Enviamos tudo para o componente visual */}
                <IntegrationsManager 
                    organizacaoId={organizacaoId}
                    metaIntegration={metaIntegration}
                    googleIntegration={googleIntegration}
                    whatsappConfig={whatsappConfig}
                />
            </div>
        </div>
    );
}
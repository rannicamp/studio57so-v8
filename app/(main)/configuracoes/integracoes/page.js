// app/(main)/configuracoes/integracoes/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IntegrationsManager from '../../../../components/configuracoes/IntegrationsManager';
import { getOrganizationId } from '@/utils/getOrganizationId'; // Helper para buscar a organização

export default async function IntegracoesPage() {
    const supabase = await createClient();

    // 1. Proteção de Rota - Verifica se o usuário está logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // 2. Busca a organização (Agora com o await corrigido na sua última atualização!)
    const organizacaoId = await getOrganizationId(user.id);
    
    if (!organizacaoId) {
        return (
            <div className="p-4 text-center text-red-600">
                Erro: Organização do usuário não encontrada. Contate o suporte.
            </div>
        );
    }

    // 3. Busca as empresas da organização
    const { data: empresas } = await supabase
        .from('cadastro_empresa')
        .select('id, razao_social')
        .eq('organizacao_id', organizacaoId);
    
    // 4. Busca configurações existentes do WhatsApp
    const { data: configs } = await supabase
        .from('configuracoes_whatsapp')
        .select('*')
        .eq('organizacao_id', organizacaoId);

    return (
        <div className="space-y-6">
            <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para Configurações
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Integrações</h1>
            <p className="text-gray-600">
                Configure as credenciais para serviços externos, como a API do WhatsApp e Open Finance.
            </p>
            <div className="bg-white rounded-lg shadow p-6">
                {/* CORREÇÃO: Passamos o organizacaoId explicitamente aqui! */}
                <IntegrationsManager 
                    empresas={empresas || []}
                    initialConfigs={configs || []}
                    organizacaoId={organizacaoId}
                />
            </div>
        </div>
    );
}
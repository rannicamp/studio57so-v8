// app/(main)/configuracoes/integracoes/page.js

import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IntegrationsManager from '../../../../components/IntegrationsManager';
import { getOrganizationId } from '@/utils/getOrganizationId'; // Helper para buscar a organização

export default async function IntegracoesPage() {
    const supabase = await createClient();

    // 1. Proteção de Rota - Verifica se o usuário está logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Precisamos saber a qual organização o usuário pertence para
    // buscar apenas os dados relevantes e seguros para ele.
    // =================================================================================
    const organizacaoId = await getOrganizationId(user.id);
    if (!organizacaoId) {
        // Se não encontrar a organização, pode ser um erro ou um usuário novo
        // Aqui, evitamos vazar dados mostrando uma página vazia ou de erro.
        return (
            <div className="p-4 text-center text-red-600">
                Erro: Organização do usuário não encontrada.
            </div>
        );
    }

    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: Adicionamos o filtro `.eq('organizacao_id', organizacaoId)`
    // para garantir que estamos buscando APENAS as empresas da organização do usuário.
    // =================================================================================
    const { data: empresas } = await supabase
        .from('cadastro_empresa')
        .select('id, razao_social')
        .eq('organizacao_id', organizacaoId); // <-- FILTRO DE SEGURANÇA!
    
    // =================================================================================
    // CORREÇÃO DE SEGURANÇA (organização_id)
    // O PORQUÊ: O mesmo filtro é aplicado aqui para buscar APENAS as configurações
    // de WhatsApp que pertencem à organização correta.
    // =================================================================================
    const { data: configs } = await supabase
        .from('configuracoes_whatsapp')
        .select('*')
        .eq('organizacao_id', organizacaoId); // <-- FILTRO DE SEGURANÇA!

    return (
        <div className="space-y-6">
            <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para Configurações
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Integrações</h1>
            <p className="text-gray-600">
                Configure as credenciais para serviços externos, como a API do WhatsApp.
            </p>
            <div className="bg-white rounded-lg shadow p-6">
                <IntegrationsManager 
                    empresas={empresas || []}
                    initialConfigs={configs || []}
                />
            </div>
        </div>
    );
}
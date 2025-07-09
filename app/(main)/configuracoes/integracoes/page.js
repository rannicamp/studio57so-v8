import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IntegrationsManager from '../../../../components/IntegrationsManager';

export default async function IntegracoesPage() {
    const supabase = createClient();

    // Proteção de Rota
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // Busca as empresas para popular o formulário
    const { data: empresas } = await supabase.from('cadastro_empresa').select('id, razao_social');
    
    // Busca as configurações já existentes
    const { data: configs } = await supabase.from('configuracoes_whatsapp').select('*');

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
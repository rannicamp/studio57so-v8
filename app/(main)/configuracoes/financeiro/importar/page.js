import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import IntegrationsManager from '../../../../components/IntegrationsManager';

// Função para verificar a permissão de acesso à página
async function checkPermissions() {
  const supabase = createClient();
  
  // 1. Verifica se há um usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. Busca o perfil do usuário para obter a função dele
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('funcao_id, funcoes ( nome_funcao )')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error("Erro ao buscar dados do usuário:", userError);
    redirect('/');
  }
  
  // A função 'Proprietário' sempre tem acesso total
  if (userData?.funcoes?.nome_funcao === 'Proprietário') {
    return true;
  }

  // 3. Para as outras funções, verifica a permissão específica
  const { data: permissionData, error: permissionError } = await supabase
    .from('permissoes')
    .select('pode_ver')
    .eq('funcao_id', userData.funcao_id)
    .eq('recurso', 'config_integracoes') // <--- Chave de permissão para esta página
    .single();

  if (permissionError || !permissionData?.pode_ver) {
    redirect('/'); // Redireciona se não tiver a permissão
  }

  return true;
}


export default async function IntegracoesPage() {
    await checkPermissions(); // Executa a verificação de segurança

    const supabase = createClient();
    
    // Se a verificação passar, busca os dados necessários para a página
    const { data: empresas } = await supabase.from('cadastro_empresa').select('id, razao_social');
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
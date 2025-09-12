import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import TipoDocumentoManager from '../../../../components/TipoDocumentoManager';

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
    .eq('recurso', 'config_tipos_documento') // <--- Chave de permissão para esta página
    .single();

  if (permissionError || !permissionData?.pode_ver) {
    redirect('/'); // Redireciona se não tiver a permissão
  }

  return true;
}


export default async function TiposDocumentoPage() {
    await checkPermissions(); // Executa a verificação de segurança

    const supabase = createClient();

    // Se a verificação passar, busca os dados da página
    const { data: tipos, error } = await supabase.from('documento_tipos').select('*').order('sigla');
    if (error) console.error("Erro ao buscar tipos de documento:", error);

    return (
        <div className="space-y-6">
            <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para Configurações
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciar Tipos de Documento</h1>
            <p className="text-gray-600">
                Adicione, edite ou remova as siglas e abreviaturas usadas para nomear os arquivos do sistema.
            </p>
            <div className="bg-white rounded-lg shadow p-6">
                <TipoDocumentoManager initialData={tipos || []} />
            </div>
        </div>
    );
}
import { createClient } from '../../../utils/supabase/server';
import Link from 'next/link';
import EmpreendimentoList from '../../../components/EmpreendimentoList';
import { redirect } from 'next/navigation'; // Importar redirect

// Função para buscar permissões do usuário logado
async function checkPermissions() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { canView: false, canCreate: false };
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao_id, funcoes(nome_funcao)')
    .eq('id', user.id)
    .single();

  // Se for Proprietário, tem acesso total
  if (userData?.funcoes?.nome_funcao === 'Proprietário') {
    return { canView: true, canCreate: true };
  }

  // Se não, busca as permissões específicas da função
  const { data: permissions } = await supabase
    .from('permissoes')
    .select('pode_ver, pode_criar')
    .eq('funcao_id', userData.funcao_id)
    .eq('recurso', 'empreendimentos') // <<< Verifica o recurso 'empreendimentos'
    .single();

  return {
    canView: permissions?.pode_ver || false,
    canCreate: permissions?.pode_criar || false
  };
}

export default async function GerenciamentoEmpreendimentosPage() {
  const { canView, canCreate } = await checkPermissions();

  if (!canView) {
    redirect('/'); // Se não pode ver, redireciona para a página inicial
  }
  
  const supabase = createClient();

  const { data: empreendimentos, error } = await supabase
    .from('empreendimentos')
    .select(`
      id,
      nome,
      status,
      empresa_proprietaria:empresa_proprietaria_id ( razao_social )
    `)
    .order('nome');

  if (error) {
    console.error('Erro ao buscar empreendimentos:', error);
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg">
        <h2 className="font-bold">Erro ao Carregar Dados</h2>
        <p>Não foi possível carregar a lista de empreendimentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Empreendimentos</h1>
        {/* O botão de "Novo Empreendimento" só aparece se o usuário tiver permissão para criar */}
        {canCreate && (
          <Link href="/empreendimentos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
            + Novo Empreendimento
          </Link>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <EmpreendimentoList initialEmpreendimentos={empreendimentos || []} />
      </div>
    </div>
  );
}
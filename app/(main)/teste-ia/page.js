import TesteIaClient from './TesteIaClient';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function TesteIaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Busca dados do usuário (especificamente a organização_id)
  const { data: userData } = await supabase
    .from('usuarios')
    .select('organizacao_id')
    .eq('id', user.id)
    .single();

  if (!userData?.organizacao_id) {
    return <div>Você precisa estar em uma organização para acessar esta página.</div>;
  }

  return (
    <div className="flex-1 w-full flex flex-col h-full max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Laboratório do Agente IA</h1>
        <p className="text-gray-600">Teste as habilidades de busca de banco de dados do Devonildo em tempo real.</p>
      </div>
      <div className="flex-1 min-h-[600px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
        <TesteIaClient organizacaoId={userData.organizacao_id} />
      </div>
    </div>
  );
}

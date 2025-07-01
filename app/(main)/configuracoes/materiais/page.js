import { createClient } from '../../../../utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MaterialManager from '../../../../components/MaterialManager'; // Importando o novo componente

export default async function GestaoMateriaisPage() {
  const supabase = createClient();

  // Proteção de rota: Apenas o Proprietário pode ver esta página
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('funcao:funcoes ( nome_funcao )')
    .eq('id', user.id)
    .single();
  
  if (userData?.funcao?.nome_funcao !== 'Proprietário') {
    redirect('/');
  }

  // Busca a lista inicial de materiais do banco de dados
  const { data: materials, error } = await supabase
    .from('materiais')
    .select('*')
    .order('descricao', { ascending: true });

  if (error) {
    console.error('Erro ao buscar materiais:', error);
    // Em caso de erro, podemos renderizar a página com uma lista vazia e uma mensagem.
  }

  return (
    <div className="space-y-6">
        <Link href="/configuracoes" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para Configurações
        </Link>
      <h1 className="text-3xl font-bold text-gray-900">Gestão de Materiais</h1>
      <p className="text-gray-600">
        Gerencie sua base de dados de materiais, realize importações, exportações e limpezas.
      </p>
      
      <div className="bg-white rounded-lg shadow p-6">
        <MaterialManager initialMaterials={materials || []} />
      </div>
    </div>
  );
}
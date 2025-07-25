import { createClient } from '../../../utils/supabase/server';
import Link from 'next/link';
import EmpreendimentoList from '../../../components/EmpreendimentoList';

export default async function GerenciamentoEmpreendimentosPage() {
  const supabase = createClient();

  // Busca os dados dos empreendimentos, incluindo o nome da empresa proprietária
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
        <Link href="/empreendimentos/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
          + Novo Empreendimento
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <EmpreendimentoList initialEmpreendimentos={empreendimentos || []} />
      </div>
    </div>
  );
}

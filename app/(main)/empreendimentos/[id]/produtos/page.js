import { createClient } from '../../../../../utils/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProdutoList from '../../../../../components/ProdutoList';

export default async function ProdutosPage({ params }) {
  const supabase = createClient();
  const { id: empreendimentoId } = params;

  // Busca os dados do empreendimento e dos produtos em paralelo
  const [
    { data: empreendimento, error: empreendimentoError },
    { data: produtos, error: produtosError },
    { data: config, error: configError }
  ] = await Promise.all([
    supabase.from('empreendimentos').select('nome').eq('id', empreendimentoId).single(),
    supabase.from('produtos_empreendimento').select('*').eq('empreendimento_id', empreendimentoId).order('unidade'),
    supabase.from('configuracoes_venda').select('valor_cub').eq('empreendimento_id', empreendimentoId).single()
  ]);

  if (empreendimentoError) {
    console.error('Erro ao buscar empreendimento:', empreendimentoError);
    notFound();
  }

  if (produtosError || configError) {
    console.error('Erro ao buscar dados da página de produtos:', { produtosError, configError });
  }

  return (
    <div className="space-y-6">
      <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
        &larr; Voltar para a Lista de Empreendimentos
      </Link>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Produtos de: <span className="text-blue-600">{empreendimento.nome}</span>
        </h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <ProdutoList 
            initialProdutos={produtos || []} 
            empreendimentoId={empreendimentoId} 
            initialConfig={config || {}}
        />
      </div>
    </div>
  );
}
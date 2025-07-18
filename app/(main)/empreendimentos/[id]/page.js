import { createClient } from '@/utils/supabase/server'; // Caminho CORRIGIDO com alias
import { cookies } from 'next/headers';
import EmpreendimentoDetails from '@/components/EmpreendimentoDetails'; // Importa o novo componente de cliente
import Link from 'next/link'; // Importar Link para o fallback de empreendimento não encontrado

export const dynamic = 'force-dynamic';

export default async function ViewEmpreendimentoPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  // 1. Buscar dados do empreendimento
  const { data: empreendimento, error: empreendimentoError } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  // 2. Buscar todas as entidades corporativas (para incorporadora/construtora)
  const { data: corporateEntities, error: entitiesError } = await supabase.rpc('get_corporate_entities');

  // 3. Buscar empresas de cadastro (para empresa proprietária)
  const { data: proprietariaOptions, error: proprietariaError } = await supabase
    .from('cadastro_empresa')
    .select('id, nome_fantasia, razao_social');

  if (empreendimentoError || entitiesError || proprietariaError) {
    console.error('Erro ao buscar dados:', empreendimentoError || entitiesError || proprietariaError);
    return (
      <div className="p-6 text-center text-red-700 bg-red-100 rounded-md">
        Erro ao carregar detalhes do empreendimento. Por favor, tente novamente.
      </div>
    );
  }

  // Se o empreendimento não for encontrado (ex: ID inválido)
  if (!empreendimento) {
    return (
      <div className="p-6 text-center text-gray-700">
        <p>Empreendimento com ID &quot;{id}&quot; não encontrado.</p>
        <Link href="/empreendimentos" className="text-blue-500 hover:underline mt-4 block">Voltar para a lista de Empreendimentos</Link>
      </div>
    );
  }

  return (
    <EmpreendimentoDetails
      empreendimento={empreendimento}
      corporateEntities={corporateEntities || []}
      proprietariaOptions={proprietariaOptions || []}
    />
  );
}
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers'; // Mantenha esta importação, embora o erro esteja no server.js
import EmpreendimentoDetails from '@/components/EmpreendimentoDetails';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ViewEmpreendimentoPage({ params }) {
  // Corrigido: `params` deve ser aguardado antes de acessar suas propriedades
  const { id } = await params;
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

  // 4. Buscar empreendimento_anexos relacionados a este empreendimento, incluindo o tipo de documento
  // Corrigido: Removida a seleção de 'public_url' pois não existe na tabela
  const { data: empreendimentoAnexos, error: anexosError } = await supabase
    .from('empreendimento_anexos')
    .select(`
      id,
      caminho_arquivo,
      nome_arquivo,
      descricao,
      tipo:documento_tipos(
        id,
        sigla,
        descricao
      )
    `)
    .eq('empreendimento_id', id);

  // 5. Buscar quadro_de_areas relacionados a este empreendimento
  const { data: quadroDeAreas, error: quadroError } = await supabase
    .from('quadro_de_areas')
    .select('*')
    .eq('empreendimento_id', id)
    .order('ordem', { ascending: true });


  if (empreendimentoError || entitiesError || proprietariaError || anexosError || quadroError) {
    console.error('Erro ao buscar dados:',
      empreendimentoError?.message || entitiesError?.message || proprietariaError?.message || anexosError?.message || quadroError?.message
    );
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
      empreendimentoAnexos={empreendimentoAnexos || []}
      quadroDeAreas={quadroDeAreas || []}
    />
  );
}
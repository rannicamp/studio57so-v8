import { createClient } from '../../../../../utils/supabase/server';
import { cookies } from 'next/headers';
// Removidas as importações do @mui/material
import EmpreendimentoForm from '@/components/EmpreendimentoForm'; // Caminho CORRIGIDO com alias

export const dynamic = 'force-dynamic';

export default async function EditarEmpreendimentoPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  const { data: empreendimento, error: empreendimentoError } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  const { data: corporateEntities, error: entitiesError } = await supabase.rpc('get_corporate_entities');

  if (empreendimentoError || entitiesError) {
    console.error('Erro ao buscar empreendimento ou entidades corporativas:', empreendimentoError || entitiesError);
    return (
      <div className="p-4 text-red-700 bg-red-100 rounded-md">
        Erro ao carregar dados do empreendimento. Tente novamente.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Editar Empreendimento
      </h1>
      <EmpreendimentoForm
        empreendimento={empreendimento}
        corporateEntities={corporateEntities || []}
      />
    </div>
  );
}
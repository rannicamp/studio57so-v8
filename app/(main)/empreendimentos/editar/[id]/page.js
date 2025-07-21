import { createClient } from '../../../../../utils/supabase/server';
import EmpreendimentoForm from '@/components/EmpreendimentoForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditarEmpreendimentoPage({ params }) {
  const { id } = params;
  const supabase = createClient();

  const { data: empreendimento, error: empreendimentoError } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  if (empreendimentoError || !empreendimento) {
    notFound();
  }

  // Busca os mesmos dados de apoio que a página de cadastro
  const { data: corporateEntities } = await supabase.rpc('get_corporate_entities');
  const { data: proprietariaOptions } = await supabase.from('cadastro_empresa').select('id, razao_social');

  return (
    <div className="space-y-6">
       <Link href="/empreendimentos" className="text-blue-500 hover:underline mb-4 inline-block">
            &larr; Voltar para a Lista de Empreendimentos
        </Link>
      <div className="bg-white rounded-lg shadow p-6">
        <EmpreendimentoForm
          empreendimento={empreendimento}
          corporateEntities={corporateEntities || []}
          proprietariaOptions={proprietariaOptions || []}
        />
      </div>
    </div>
  );
}
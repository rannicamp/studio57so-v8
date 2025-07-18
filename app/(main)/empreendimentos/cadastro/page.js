import { createClient } from '../../../../../utils/supabase/server';
import { cookies } from 'next/headers';
// Removidas as importações do @mui/material
import EmpreendimentoForm from '@/components/EmpreendimentoForm'; // Caminho CORRIGIDO com alias

export const dynamic = 'force-dynamic';

export default async function CadastroEmpreendimentoPage() {
  const supabase = createClient();

  const { data: corporateEntities, error: entitiesError } = await supabase.rpc('get_corporate_entities');

  if (entitiesError) {
    console.error('Erro ao buscar entidades corporativas:', entitiesError);
    return (
      <div className="p-4 text-red-700 bg-red-100 rounded-md">
        Erro ao carregar a lista de empresas. Por favor, tente novamente.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Cadastrar Novo Empreendimento
      </h1>
      <EmpreendimentoForm
        empreendimento={null}
        corporateEntities={corporateEntities || []}
      />
    </div>
  );
}
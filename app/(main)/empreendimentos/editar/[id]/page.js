import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Box, Typography } from '@mui/material';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';

export const dynamic = 'force-dynamic';

export default async function EditarEmpreendimentoPage({ params }) {
  const { id } = params;
  const supabase = createServerComponentClient({ cookies });

  const { data: empreendimento, error: empreendimentoError } = await supabase
    .from('empreendimentos')
    .select('*')
    .eq('id', id)
    .single();

  // Buscar todas as entidades (empresas/contatos com CNPJ) usando a nova função RPC
  const { data: corporateEntities, error: entitiesError } = await supabase.rpc('get_corporate_entities');

  if (empreendimentoError || entitiesError) {
    console.error('Erro ao buscar empreendimento ou entidades corporativas:', empreendimentoError || entitiesError);
    return <Typography color="error">Erro ao carregar dados. Tente novamente.</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Editar Empreendimento
      </Typography>
      <EmpreendimentoForm
        empreendimento={empreendimento}
        corporateEntities={corporateEntities || []} // Passa as entidades para o formulário
      />
    </Box>
  );
}
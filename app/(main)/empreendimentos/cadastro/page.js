import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Box, Typography } from '@mui/material';
import EmpreendimentoForm from '../../../../components/EmpreendimentoForm';

export const dynamic = 'force-dynamic';

export default async function CadastroEmpreendimentoPage() {
  const supabase = createServerComponentClient({ cookies });

  // Buscar todas as entidades (empresas/contatos com CNPJ) usando a nova função RPC
  const { data: corporateEntities, error: entitiesError } = await supabase.rpc('get_corporate_entities');

  if (entitiesError) {
    console.error('Erro ao buscar entidades corporativas:', entitiesError);
    // Você pode mostrar uma mensagem de erro ao usuário aqui
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Cadastrar Novo Empreendimento
      </Typography>
      <EmpreendimentoForm
        empreendimento={null}
        corporateEntities={corporateEntities || []} // Passa as entidades para o formulário
      />
    </Box>
  );
}
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runAtualizacao(id, diagnostico, solucao) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('URL ou Key não encontrados');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('feedback')
    .update({
      diagnostico: diagnostico,
      plano_solucao: solucao,
      status: 'Em Análise'
    })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar:', error);
    return;
  }
  console.log('Feedback atualizado com sucesso:', id);
}

async function main() {
  const diagnostico = 'O componente `LinkContactModal` no `UserManagementForm.js` está utilizando a busca por `nome.ilike`, porém, muitos contatos do tipo Pessoa Jurídica possuem apenas `razao_social` preenchida e `nome` nulo. Além disso, a exibição na lista suspensa também depende exclusivamente da propriedade `c.nome`, tornando os contatos invisíveis ou mostrando resultados vazios ao tentar vincular usuários do painel administrativo a contatos do CRM.';
  const solucao = 'Modificar a consulta no Supabase dentro do `searchContacts` para buscar de forma combinada utilizando `.or(\`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%\`)`. Adicionar `razao_social` no `.select()`. E por fim, na renderização da lista interativa `onClick` e na exibição `<span>`, aplicar a lógica de fallback `c.nome || c.razao_social`.';
  await runAtualizacao(144, diagnostico, solucao);
}

main().catch(console.error);

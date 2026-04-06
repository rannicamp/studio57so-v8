require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getNewTickets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select(`
      id, pagina, descricao, imagem_url, status, diagnostico, 
      auth_users:usuario_id(raw_user_meta_data),
      organizacoes:organizacao_id(id, nome)
    `)
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);

  if (error) {
    console.error(error);
  } else {
    const formatted = data.map(t => ({
      id: t.id,
      pagina: t.pagina,
      descricao: t.descricao,
      imagem_url: t.imagem_url,
      status: t.status,
      autor_nome: t.auth_users?.raw_user_meta_data?.nome,
      organizacao_nome: t.organizacoes?.nome
    }));
    console.log(JSON.stringify(formatted, null, 2));
  }
}
getNewTickets();

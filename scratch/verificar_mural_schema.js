const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Erro: Variáveis do Supabase não encontradas!");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Verificando se a tabela sys_chat_mural_posts aceita author_id nulo e suas restrições...");
  
  // Vamos fazer uma query usando execute_sql_query no supabase se existir RPC, 
  // ou simplesmente ler os metadados ou fazer um select de teste.
  // Vamos tentar ler um registro existente para ver as propriedades
  const { data: posts, error: errPosts } = await supabase.from('sys_chat_mural_posts').select('*').limit(5);
  if (errPosts) {
    console.error("Erro ao buscar posts:", errPosts);
  } else {
    console.log("Exemplo de posts existentes:", posts);
  }

  // Buscar usuários para ver se existe algum "Sistema" ou Administrador padrão por organização
  const { data: users, error: errUsers } = await supabase.from('usuarios').select('id, nome, sobrenome, email, organizacao_id').limit(10);
  if (errUsers) {
    console.error("Erro ao buscar usuarios:", errUsers);
  } else {
    console.log("Exemplo de usuarios:", users);
  }
}

main().catch(console.error);

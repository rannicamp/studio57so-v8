const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Removendo a trava uq_organizacao_google do banco de dados...');
  // A melhor forma de dropar a constraint via API do Supabase se não houver acesso direto ao SQL
  // é chamando uma RPC, mas como não temos, vou tentar remover pelo painel ou pedir pro usuário rodar o SQL.
}

run();

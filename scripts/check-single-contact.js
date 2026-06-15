const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, organizacao_id')
    .eq('organizacao_id', 2);

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('Usuários da Organização 2:', users);
}

run();

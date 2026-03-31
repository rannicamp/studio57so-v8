const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const historyPromise = supabase
        .from('historico_movimentacao_funil')
        .select('*, coluna_anterior:coluna_anterior_id(nome), coluna_nova:coluna_nova_id(nome), usuario:usuario_id(nome, sobrenome)')
        .eq('contato_no_funil_id', '91c6b146-e500-4c80-b1de-033398edaa64')
        .eq('organizacao_id', 2)
        .order('data_movimentacao', { ascending: false });

  const { data, error } = await historyPromise;

  if (error) {
    console.error(error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkDuplicates();

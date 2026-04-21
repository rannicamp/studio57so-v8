const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: estoque, error: eErr } = await supabase
    .from('estoque')
    .select('*, material:materiais(id, nome, classificacao, organizacao_id)')
    .eq('organizacao_id', 2);
  
  if (eErr) console.error('Er estoque:', eErr.message);
  else console.log('Estoque Rows: ', estoque.length);

  // Lets see first 5 row sample
  console.log('Sample:', JSON.stringify(estoque.slice(0,2), null, 2));

  // Let's check how many total materiais we have
  const { data: mat, error: mErr } = await supabase
    .from('materiais')
    .select('id, nome, classificacao, organizacao_id');
  console.log('Materiais totais:', mat ? mat.length : 0);
}

check();

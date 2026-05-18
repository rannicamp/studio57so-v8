require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const searchTerm = 'sendy';
  const { data, error } = await supabase
    .from('contatos')
    .select('id, nome, razao_social, telefone')
    .or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%`)
    .eq('organizacao_id', 2)
    .limit(10);

  console.log('Data:', data);
  if (error) console.error('Error:', error);
}
run().catch(console.error);

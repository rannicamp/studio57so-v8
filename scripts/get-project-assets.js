const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== EMPREENDIMENTOS ===');
  const { data: emps } = await supabase.from('empreendimentos').select('id, nome');
  console.log(emps);

  console.log('\n=== ANEXOS ===');
  const { data: anexos } = await supabase
    .from('empreendimento_anexos')
    .select('id, empreendimento_id, nome_arquivo, caminho_arquivo');
  console.log(anexos);
}

run().catch(console.error);

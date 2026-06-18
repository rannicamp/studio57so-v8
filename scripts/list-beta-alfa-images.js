const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: anexos } = await supabase
    .from('empreendimento_anexos')
    .select('id, empreendimento_id, nome_arquivo, caminho_arquivo')
    .in('empreendimento_id', [1, 5])
    .ilike('nome_arquivo', '%[IMG]%');
    
  console.log('=== IMAGENS DE ALFA E BETA ===');
  anexos.forEach(a => {
    console.log(`ID: ${a.id} | Empreendimento: ${a.empreendimento_id} | Nome: ${a.nome_arquivo} | Caminho: ${a.caminho_arquivo}`);
  });
}

run().catch(console.error);

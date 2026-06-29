// scratch/listar_anexos.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== LISTANDO ANEXOS DO WHATSAPP NO BANCO ===");

  const { data: anexos, error: errA } = await supabase
    .from('whatsapp_attachments')
    .select('*');

  if (errA) {
    console.error("Erro ao buscar anexos:", errA.message);
    return;
  }

  console.log(`Anexos encontrados: ${anexos?.length || 0}`);
  console.table(anexos.map(a => ({
    ID: a.id,
    Nome: a.nome,
    Url: a.url ? a.url.substring(0, 50) + '...' : 'null',
    Org_ID: a.organizacao_id
  })));
}

main();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function debug() {
  console.log("=== CHECKING META INTEGRACOES ===");
  const { data: ints } = await supabase.from('integracoes_meta').select('id, organizacao_id, page_id, page_name, created_at');
  console.log("Integracoes Meta:", ints);

  console.log("\n=== CHECKING LATEST CONTACTS ===");
  const { data: contacts } = await supabase.from('contatos')
    .select('id, nome, origem, created_at, meta_lead_id')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("Latest contacts:", contacts);

  console.log("\n=== CHECKING FUNNEL ENTRY COLUMNS ===");
  const { data: funis } = await supabase.from('funis').select('id, nome, organizacao_id, is_sistema');
  console.log("Funis:", funis);
  
  const { data: cols } = await supabase.from('colunas_funil').select('id, nome, funil_id, tipo_coluna');
  console.log("Colunas de entrada disponíveis:", cols.filter(c => c.tipo_coluna === 'entrada'));
}

debug().catch(console.error);

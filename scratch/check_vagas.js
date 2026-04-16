require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: empreendimento } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%Beta%')
    .single();

  const { data: vagas, error } = await supabase
    .from('produtos_empreendimento')
    .select('id, unidade, tipo, area_m2')
    .eq('empreendimento_id', empreendimento.id)
    .order('unidade');

  console.log(`Unidades Encontradas para ${empreendimento.nome} (${vagas.length}):`);
  vagas.forEach(v => {
      console.log(`  - BD: Unidade: ${v.unidade} | Tipo: ${v.tipo} | Área: ${v.area_m2}m²`);
  });
}

run();

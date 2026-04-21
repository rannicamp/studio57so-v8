const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKpiLogic() {
  const { data, error } = await supabase.rpc('get_almoxarifado_kpis', {
    p_organizacao_id: 2,
    p_empreendimento_id: 'all'
  });
  
  if (error) console.error('RPC Error:', error);
  else console.log('RPC Data:', data);
  
  // Let's do a direct join query to see what's happening
  const { data: directData, error: dErr } = await supabase
    .from('estoque')
    .select('*, material:materiais(id, nome, classificacao)')
    .eq('organizacao_id', 2);
    
  if (dErr) return console.log(dErr);
  
  let validStock = directData.filter(d => (d.quantidade_atual + d.quantidade_em_uso) > 0 && d.material?.classificacao !== 'Serviço');
  console.log('Valid Stock items matching join:', validStock.length);
  
  const totalFisico = validStock.reduce((acc, curr) => acc + curr.quantidade_atual + curr.quantidade_em_uso, 0);
  console.log('Total Fisico direct logic:', totalFisico);
}

checkKpiLogic();

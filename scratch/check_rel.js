require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('hello_world'); // Apenas para testar conexão, mas na real não dá info do schema.
  
  // Vamos buscar na information_schema usando uma query bruta via postgres ou pegando as tabelas conhecidas.
  // Como nao temos rpc custom de schema, vamos tentar baixar os contratos órfãos e ver se tem um JSON neles.
  
  const { data: emp } = await supabase.from('empreendimentos').select('id, nome').ilike('nome', '%Alfa%').single();
  const { data: produtos } = await supabase.from('produtos_empreendimento').select('id, unidade').eq('empreendimento_id', emp.id);
  const { data: contratos } = await supabase.from('contratos').select('*').eq('empreendimento_id', emp.id).eq('status_contrato', 'Assinado');

  console.log("CONTRATOS ORFÃOS DE PRODUTO_ID NO RESIDENCIAL ALFA:");
  for (const c of contratos) {
      if (!c.produto_id) {
          console.log(`\nContrato ID: ${c.id}`);
          console.log(`Cliente/Nome: ${c.comprador_nome}`);
          console.log(`Unidades array? : ${JSON.stringify(c.unidades)}`);
          console.log(`Produto IDs array? : ${JSON.stringify(c.produto_ids)}`);
          // Mostrar keys do contrato
          console.log("Keys disponíveis no contrato:", Object.keys(c).filter(k => k.includes('prod') || k.includes('unid')));
      }
  }

  // Tentar buscar uma possível tabela de relacionamento
  const { data: testRel, error: errRel } = await supabase.from('contrato_produtos').select('*').limit(2);
  if (!errRel) console.log("Tabela 'contrato_produtos' EXISTE!");
  
  const { data: testRel2, error: errRel2 } = await supabase.from('produtos_contrato').select('*').limit(2);
  if (!errRel2) console.log("Tabela 'produtos_contrato' EXISTE!");
  
  const { data: testRel3, error: errRel3 } = await supabase.from('unidades_contrato').select('*').limit(2);
  if (!errRel3) console.log("Tabela 'unidades_contrato' EXISTE!");
}

run();

// scripts/consultar_duracao_dias.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("Consultando datas e duracao_dias no banco...");
  const { data, error } = await supabase
    .from('activities')
    .select('id, nome, data_inicio_prevista, data_fim_prevista, duracao_dias')
    .eq('empreendimento_id', 5)
    .eq('organizacao_id', 2)
    .in('id', [1174, 1175, 1176, 1177, 1178, 1179, 1180, 1181, 1182, 1183, 1184, 1185, 1186]);

  if (error) {
    console.error("Erro:", error);
    return;
  }

  data.forEach(act => {
    console.log(`ID ${act.id} | ${act.nome.padEnd(50)} | Início: ${act.data_inicio_prevista} | Fim: ${act.data_fim_prevista} | duracao_dias: ${act.duracao_dias}`);
  });
}

run();

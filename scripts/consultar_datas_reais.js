// scripts/consultar_datas_reais.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  console.log("Consultando datas reais do banco para as tarefas complementares do Beta Suítes...");
  const { data, error } = await supabase
    .from('activities')
    .select('id, nome, status, data_inicio_prevista, data_fim_prevista, data_inicio_real, data_fim_real')
    .eq('empreendimento_id', 5)
    .eq('organizacao_id', 2)
    .in('id', [1174, 1175, 1176, 1177, 1178, 1179, 1180, 1181, 1182, 1183, 1184, 1185, 1186]);

  if (error) {
    console.error("Erro:", error);
    return;
  }

  data.forEach(act => {
    console.log(`ID ${act.id} | ${act.nome.padEnd(50)} | Prevista: ${act.data_inicio_prevista} a ${act.data_fim_prevista} | Real: ${act.data_inicio_real} a ${act.data_fim_real} | Status: ${act.status}`);
  });
}

run();

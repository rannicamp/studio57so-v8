// scripts/testar_calculo_gantt.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  // Busca atividades ativas do Beta Suítes
  const { data: acts, error } = await supabase
    .from('activities')
    .select('id, nome, status, data_inicio_prevista, data_fim_prevista, atividade_pai_id')
    .eq('empreendimento_id', 5)
    .eq('organizacao_id', 2)
    .not('status', 'in', '("Concluído","Cancelado")');

  if (error) {
    console.error("Erro:", error);
    return;
  }

  const getStartDate = (act) => act.start_date || act.data_inicio_prevista || act.data_inicio_real || new Date();
  const getEndDate = (act) => act.end_date || act.data_fim_prevista || act.data_fim_real || getStartDate(act);

  let min = new Date(getStartDate(acts[0]));
  let max = new Date(getEndDate(acts[0]));

  acts.forEach(act => {
    const startStr = getStartDate(act);
    if (startStr) {
      const start = new Date(startStr);
      if (start < min) min = start;
    }
    const endStr = getEndDate(act);
    if (endStr) {
      const end = new Date(endStr);
      if (end > max) max = end;
    }
  });

  // Margem de segurança visual
  min.setDate(min.getDate() - 5);
  max.setDate(max.getDate() + 15);

  min.setHours(0, 0, 0, 0);
  max.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(max - min);
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  console.log(`=== GANTT RANGE GLOBAL ===`);
  console.log(`Min Date (Gantt Start): ${min.toISOString().split('T')[0]}`);
  console.log(`Max Date (Gantt End): ${max.toISOString().split('T')[0]}`);
  console.log(`Total Days: ${totalDays}`);

  console.log(`\n=== TAREFAS CALCULADAS ===`);
  const mapped = acts.map(act => {
    const actStartStr = getStartDate(act);
    const actEndStr = getEndDate(act);

    const start = new Date(actStartStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(actEndStr);
    end.setHours(0, 0, 0, 0);

    let startDiff = 0;
    if (!isNaN(start)) {
      startDiff = Math.floor((start - min) / (1000 * 60 * 60 * 24));
    }

    let duration = 1;
    if (!isNaN(start) && !isNaN(end)) {
      duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (duration < 1) duration = 1;
      else duration += 1;
    }

    return {
      id: act.id,
      nome: act.nome,
      status: act.status,
      startStr: actStartStr,
      endStr: actEndStr,
      startDiff,
      duration
    };
  });

  // Imprime algumas tarefas para analisar
  mapped.slice(0, 20).forEach(t => {
    console.log(`ID ${t.id} | ${t.nome.padEnd(50)} | Início: ${t.startStr} | Fim: ${t.endStr} | Diff: ${t.startDiff} | Dur: ${t.duration}`);
  });
}

run();

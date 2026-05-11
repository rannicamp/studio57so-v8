require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('URL ou Key do Supabase não encontradas.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Consultando banco via Supabase JS...");

  try {
    const { data: allToday, error: e1 } = await supabase
      .from('contatos')
      .select('id')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (e1) throw e1;
    console.log("Total de contatos criados hoje (11/05/2026):", allToday.length);

    const { data: leadsToday, error: e2 } = await supabase
      .from('contatos')
      .select('id, tipo, etapa_funil')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (e2) throw e2;

    const leadsCount = leadsToday.filter(c => c.tipo && c.tipo.toLowerCase().includes('lead')).length;
    console.log("Total de contatos criados hoje com tipo 'Lead':", leadsCount);

    const funilCount = leadsToday.filter(c => !c.etapa_funil || c.etapa_funil.toLowerCase().includes('lead')).length;
    console.log("Total de contatos criados hoje por etapa de funil (Lead ou NULL):", funilCount);

    const map = {};
    leadsToday.forEach(c => {
      const key = `${c.tipo || 'NULO'} | ${c.etapa_funil || 'NULO'}`;
      map[key] = (map[key] || 0) + 1;
    });

    console.log("Detalhamento por tipo/etapa de contatos criados hoje:");
    console.table(Object.entries(map).map(([k, v]) => {
      const parts = k.split(' | ');
      return { tipo: parts[0], etapa_funil: parts[1], quantidade: v };
    }));

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();

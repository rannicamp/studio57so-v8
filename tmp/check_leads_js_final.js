require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: leadsToday, error } = await supabase
      .from('contatos')
      .select('id, created_at, nome, tipo_contato, origem')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (error) throw error;
    
    console.log("=== RELATÓRIO DE CONTATOS CRIADOS HOJE (11/05/2026) ===");
    console.log("Total de contatos criados hoje:", leadsToday.length);
    console.table(leadsToday);

    const counts = {};
    leadsToday.forEach(c => {
      const tipo = c.tipo_contato || 'NULO';
      counts[tipo] = (counts[tipo] || 0) + 1;
    });

    console.log("--- Agrupado por tipo_contato ---");
    console.table(counts);

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();

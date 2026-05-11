require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: leadsToday, error } = await supabase
      .from('contatos')
      .select('*')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (error) throw error;
    
    // Filtramos apenas os campos que não são nulos para vermos o que preencheu
    const cleanedLeads = leadsToday.map(lead => {
       const obj = {};
       for (const key in lead) {
          if (lead[key] !== null && lead[key] !== undefined && lead[key] !== '') {
             obj[key] = lead[key];
          }
       }
       return obj;
    });
    
    console.log("=== DADOS BRUTOS DOS 4 LEADS DE HOJE ===");
    cleanedLeads.forEach((c, idx) => {
       console.log(`\nLEAD ${idx + 1}: ${c.nome}`);
       console.log("Campos preenchidos:", Object.keys(c).join(', '));
       if (c.criado_por_usuario_id) console.log("criado_por_usuario_id:", c.criado_por_usuario_id);
       if (c.corretor_id) console.log("corretor_id:", c.corretor_id);
       if (c.responsavel_id) console.log("responsavel_id:", c.responsavel_id);
       if (c.etapa_funil) console.log("etapa_funil:", c.etapa_funil);
    });

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();

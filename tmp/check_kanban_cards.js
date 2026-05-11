require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Pega os 4 leads de hoje
    const { data: leadsToday, error: e1 } = await supabase
      .from('contatos')
      .select('id, nome, origem')
      .gte('created_at', '2026-05-11T00:00:00.000Z');

    if (e1) throw e1;
    const leadIds = leadsToday.map(l => l.id);

    console.log(`Buscando cartões no funil para os contatos IDs: ${leadIds.join(', ')}`);

    // 2. Pega os cartões no funil
    const { data: cards, error: e2 } = await supabase
      .from('contatos_no_funil')
      .select(`
        id, 
        contato_id, 
        corretor_id, 
        coluna_id,
        created_at
      `)
      .in('contato_id', leadIds);

    if (e2) throw e2;

    // 3. Montar relatório
    const report = leadsToday.map(lead => {
      const card = cards.find(c => c.contato_id === lead.id);
      return {
        contato: lead.nome,
        tem_cartao: !!card,
        corretor_id: card ? card.corretor_id : 'NENHUM',
        coluna_id: card ? card.coluna_id : 'NENHUM',
        criado_em: card ? card.created_at : 'NENHUM'
      };
    });

    console.table(report);

  } catch(e) {
    console.error("FALHA NA CONSULTA:", e.message);
  }
}

run();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  try {
    const orgId = 2;
    console.log("=== POSIÇÃO DOS LEADS RECENTES NOS FUNIS ===");
    
    // Get last 10 leads
    const { data: conts } = await supabase
      .from('contatos')
      .select('id, nome, created_at, origem')
      .eq('organizacao_id', orgId)
      .eq('tipo_contato', 'Lead')
      .order('created_at', { ascending: false })
      .limit(10);

    if (conts && conts.length > 0) {
      const contactIds = conts.map(c => c.id);
      
      const { data: cards, error: errCards } = await supabase
        .from('contatos_no_funil')
        .select(`
          id,
          contato_id,
          coluna_id,
          colunas_funil(nome, funil_id, funis(nome))
        `)
        .in('contato_id', contactIds);
        
      if (errCards) throw errCards;
      
      conts.forEach(c => {
        const cCard = cards.find(card => card.contato_id === c.id);
        console.log(`Lead: ${c.nome} (${c.id}) | Origem: ${c.origem} | Criado: ${c.created_at}`);
        if (cCard) {
          console.log(`  -> No Funil: "${cCard.colunas_funil?.funis?.nome}" | Coluna: "${cCard.colunas_funil?.nome}" (ID: ${cCard.coluna_id})`);
        } else {
          console.log(`  -> Não está em nenhum funil!`);
        }
      });
    }

  } catch (e) {
    console.error("Erro:", e);
  }
}

run();

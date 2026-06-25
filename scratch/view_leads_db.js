// scratch/view_leads_db.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const ids = [6067, 3401, 3467, 6051, 6058];
  
  console.log("=== DADOS DOS CONTATOS NO BANCO ===");
  const { data: contatos, error: errC } = await supabase
    .from('contatos')
    .select('id, nome, ia_atendimento_ativo, origem, objetivo, renda_familiar, fgts, created_at, meta_campaign_name, meta_form_data')
    .in('id', ids);

  if (errC) {
    console.error("Erro ao buscar contatos:", errC);
  } else {
    console.table(contatos);
  }

  for (const id of ids) {
    console.log(`\n======================================================`);
    console.log(`MENSAGENS DO CONTATO ID: ${id}`);
    console.log(`======================================================`);
    const { data: msgs, error: errM } = await supabase
      .from('whatsapp_messages')
      .select('id, content, direction, created_at, status, error_message')
      .eq('contato_id', id)
      .order('created_at', { ascending: true });

    if (errM) {
      console.error(`Erro ao buscar mensagens do contato ${id}:`, errM);
    } else if (msgs) {
      msgs.forEach(m => {
        console.log(`[${m.created_at}] [${m.direction.toUpperCase()}] Status: ${m.status} | Erro: ${m.error_message || 'Nenhum'}`);
        console.log(`Conteúdo: "${m.content}"`);
        console.log(`------------------------------------------------------`);
      });
    }
  }
}

main();

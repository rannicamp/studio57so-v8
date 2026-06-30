require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const stellaUserId = '1c69bf44-6bcc-4fce-8702-f2fd4c7f114d';

  console.log("Buscando atividades criadas pela Stella IA...");
  const { data: activities, error } = await supabase
    .from('activities')
    .select('id, nome, descricao, contato_id, created_at, status')
    .eq('criado_por_usuario_id', stellaUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log(`Total de atividades criadas pela Stella no banco: ${activities.length}`);
  
  // Agrupar por contato_id
  const porContato = {};
  activities.forEach(act => {
    if (!porContato[act.contato_id]) porContato[act.contato_id] = [];
    porContato[act.contato_id].push(act);
  });

  for (const [contatoId, list] of Object.entries(porContato)) {
    console.log(`\nContato ID: ${contatoId} (Total: ${list.length})`);
    list.slice(0, 10).forEach(act => {
      console.log(`  - [ID ${act.id}] Criado: ${act.created_at} | Status: ${act.status} | Titulo: ${act.nome} | Descricao: ${act.descricao.substring(0, 50)}...`);
    });
  }
}

main().catch(console.error);

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const empId = 5; // Beta Suítes
  
  // Checking `activities` table
  const { data: activities, error: errAct } = await supabase
    .from('activities')
    .select('*')
    .eq('entidade_id', empId)
    .eq('entidade_tipo', 'empreendimento');

  const { data: activities2, error: errAct2 } = await supabase
    .from('activities')
    .select('*')
    .eq('empreendimento_id', empId);

  let allActivities = [];
  if (activities && activities.length > 0) allActivities.push(...activities);
  if (activities2 && activities2.length > 0) allActivities.push(...activities2);

  // Removing duplicates if any
  const uniqueActivities = Array.from(new Set(allActivities.map(a => a.id)))
    .map(id => allActivities.find(a => a.id === id));

  console.log("Total activities found:", uniqueActivities.length);
  if (uniqueActivities.length > 0) {
    uniqueActivities.forEach(a => {
       console.log(`- [${new Date(a.created_at).toLocaleDateString()}] ${a.title || a.titulo || a.descricao || a.action} (${a.status})`);
    });
  }

  // Also checking 'atividades_elementos' if it exists
  const { data: atividadesElementos } = await supabase
    .from('atividades_elementos')
    .select('*')
    .eq('empreendimento_id', empId);

  console.log("\nTotal atividades_elementos found:", atividadesElementos?.length || 0);

  fs.writeFileSync('c:\\Projetos\\studio57so-v8\\tmp\\beta_suites_activities.json', JSON.stringify({ uniqueActivities, atividadesElementos }, null, 2));
}

run();

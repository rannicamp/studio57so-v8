require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const empId = 5; // Beta Suítes
  
  // Buscar a atividade específica
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .ilike('title', '%Salomão ou Yann%');

  if (activities && activities.length > 0) {
    const actId = activities[0].id;
    const { error: updateError } = await supabase
      .from('activities')
      .update({ 
        status: 'Concluído', 
        title: 'Escolha do profissional: Salomão contratado e data garantida na agenda.' 
      })
      .eq('id', actId);
      
    if (updateError) {
      console.error("Erro ao atualizar:", updateError);
    } else {
      console.log("Atividade atualizada com sucesso no banco de dados!");
    }
  } else {
    console.log("Atividade não encontrada pelo texto.");
  }
}

run();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixStatus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .update({ status: 'Implementado' })
    .eq('status', 'Resolvido');

  if (error) console.error("Erro:", error);
  else console.log("Corrigido! Todos que estavam 'Resolvido' agora são 'Implementado'.");
}
fixStatus();

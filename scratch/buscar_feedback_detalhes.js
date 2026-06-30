require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function buscar() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('id', 167)
    .single();

  if (error) {
    console.error("Erro:", error.message);
  } else {
    console.log("=== FEEDBACK 167 ===");
    console.log(JSON.stringify(data, null, 2));
  }
}

buscar().catch(console.error);

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('consultar_sql', {
    q: `SELECT proname as name, prosrc as code FROM pg_proc WHERE proname LIKE '%sinal_lancamento%';`
  });
  if (error) console.log("Try 1 Error:", error.message);
  else console.log(data);
}
check();

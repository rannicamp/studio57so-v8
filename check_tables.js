const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sa.rpc('run_sql', { sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%fatura%'" });
  console.log('Tables:', data);
  const { data: d2 } = await sa.rpc('run_sql', { sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%cartao%'" });
  console.log('Tables 2:', d2);
}
run();

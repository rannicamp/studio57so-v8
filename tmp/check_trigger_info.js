const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        SELECT event_manipulation, action_statement, action_timing
        FROM information_schema.triggers
        WHERE event_object_table = 'contatos_no_funil';
      `
  });
  console.log(error || data);
}

check();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc('get_tables'); // Or I can just check the dbelo57.sql
    if (error) {
       // Let's do a fallback reading the SQL file
       console.log('Cant use RPC, checking SQL via another way');
    }
  } catch(e) {}
}

run();

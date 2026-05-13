import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicy() {
  const { data, error } = await supabaseAdmin.rpc('run_sql', {
    sql_query: "SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'permissoes';"
  });
  if (error) {
    console.error('Error fetching policies:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
checkPolicy();

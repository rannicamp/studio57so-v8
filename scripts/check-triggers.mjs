import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_triggers_for_table', { table_name: 'whatsapp_messages' });
  
  if (error) {
      // Fallback query if RPC doesn't exist
      const { data: triggers } = await supabaseAdmin.rpc('execute_sql', { query: `
          SELECT event_object_table, trigger_name, action_statement
          FROM information_schema.triggers
          WHERE event_object_table = 'whatsapp_messages'
      `});
      // if that fails, let's just do a direct pg call via rest API? Supabase doesn't allow arbitrary SQL easily without a function.
      // BUT I have Postgres connection URL in .env.local maybe? No.
      console.log('Error picking rpc', error);
  } else {
      console.log("TRIGGERS:", data);
  }
}
run();

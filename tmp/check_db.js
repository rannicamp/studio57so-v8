
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const t = ['logos', 'log', 'logs_sistema', 'auditoria'];
  for (const name of t) {
    try {
      const { data, error } = await supabase.from(name).select('*').limit(3).order('id', {ascending: false});
      if (data && data.length) console.log(name, ':', data);
      else if (error) console.log(name, 'error:', error.message);
      else console.log(name, 'empty');
    } catch(e) {
      console.log(e.message);
    }
  }
}
listTables();


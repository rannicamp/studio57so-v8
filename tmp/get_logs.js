
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function getLogs() {
  const { data } = await supabase.from('logs_erros_ui').select('*').order('created_at', { ascending: false }).limit(3);
  console.log('UI Logs:', data);
}
getLogs();


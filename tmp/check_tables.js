
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_table_names').catch(() => ({}));
  if (data) console.log(data);
  // Alternative method: just try some common names
  const names = ['logs', 'system_logs', 'log_auditoria', 'logs_sistema', 'error_logs', 'error_log', 'log_erros'];
  for (const name of names) {
    const { error } = await supabase.from(name).select('id').limit(1).catch(()=>({error:{message:'not found'}}));
    if (!error || !error.message.includes('does not exist')) {
        console.log('Tabela encontrada:', name);
        const { data } = await supabase.from(name).select('*').order('created_at', { ascending: false }).limit(5);
        console.log(data);
        return;
    }
  }
  console.log('Nenhuma tabela comum encontrada.');
}
checkTables();


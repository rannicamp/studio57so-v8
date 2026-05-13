
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCron() {
  const { data, error } = await supabase.rpc('query_cron_jobs').catch(() => ({}));
  if (error || !data) {
    console.log('Sem acesso a pg_cron via RPC, verificando triggers...');
    const res = await supabase.from('pg_stat_user_tables').select('*').limit(1).catch(()=>({}));
    console.log('Tudo OK, sem tarefas listadas explicitamente.');
  } else {
    console.log(data);
  }
}
checkCron();


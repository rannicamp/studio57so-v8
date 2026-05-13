
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function checkRLS() {
  const { data } = await supabase.rpc('get_policies_for_table', { table_name: 'permissoes' }).catch(() => ({}));
  if(data) console.log(data);
  else {
    const res = await supabase.from('permissoes').select('*').limit(1);
    console.log(res);
  }
}
checkRLS();


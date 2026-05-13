
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabaseAdmin
    .from('funcoes')
    .select('*, permissoes(*)')
    .eq('id', 22);
  console.log(JSON.stringify(data, null, 2));
}
run();


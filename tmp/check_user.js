
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabaseAdmin.from('usuarios').select('id, nome, funcao_id, organizacao_id').eq('organizacao_id', 2);
  console.log(data);
}
run();


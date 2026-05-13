
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: user } = await supabaseAdmin.from('usuarios').select('id, funcao_id').limit(1).single();
  if (!user) return;
  const { error } = await supabaseAdmin.from('usuarios').update({ updated_at: new Date() }).eq('id', user.id);
  console.log('Update result:', error ? error.message : 'Success');
}
test();


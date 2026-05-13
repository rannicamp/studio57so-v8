
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllLogs() {
  const { data } = await supabase.from('logs_erros_ui')
    .select('id, created_at, mensagem, url_atual')
    .order('created_at', { ascending: false })
    .limit(30);
  console.log(data);
}
getAllLogs();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const today = new Date();
  today.setHours(0,0,0,0);

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, content, created_at, organizacao_id, sender_id')
    .eq('direction', 'inbound')
    //.eq('organizacao_id', 2)  (todos os wpp já estão na org 2 após meu fix)
    .lt('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) console.error("Error:", error);
  else console.log("Últimas 5 mensagens INBOUND recebidas (antes de hoje):", data);
}
run();

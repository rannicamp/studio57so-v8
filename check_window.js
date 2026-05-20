require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: conv } = await supabase.from('whatsapp_conversations').select('id, phone_number, customer_window_start_at').eq('id', 9042).single();
  console.log("Conversa 9042:", conv);
  
  const { data: conv15484 } = await supabase.from('whatsapp_conversations').select('*').eq('id', 15484).maybeSingle();
  console.log("Conversa 15484:", conv15484);
}
run();

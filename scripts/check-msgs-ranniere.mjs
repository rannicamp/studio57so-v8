import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: msgs } = await supabaseAdmin.from('whatsapp_messages')
    .select('id, content, status, direction, created_at, error_message')
    .eq('receiver_id', '553391912291')
    .gte('created_at', '2026-03-26T12:30:00.000Z')
    .order('created_at', { ascending: false });
    
  console.log("=== MENSAGENS PARA O RANNIERE (HOJE) ===");
  console.table(msgs);
  
  // Verifica se tem erro no webhook tbm
  const { data: cw } = await supabaseAdmin.from('whatsapp_conversations')
    .select('last_status, phone_number')
    .eq('phone_number', '553391912291')
    .single();
    
  console.log("CONVERSA:", cw);
}
run();

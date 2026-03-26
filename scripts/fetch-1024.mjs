import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Pega TODAS as mensagens (inclusive de texto) nas últimas 2 horas
  // para entender a cronologia exata.
  const { data: msgs } = await supabaseAdmin.from('whatsapp_messages')
    .select('id, content, status, error_message, direction, created_at, raw_payload')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log("=== ÚLTIMAS 10 MENSAGENS EM TODO O SISTEMA ===");
  for (const m of msgs) {
      console.log(`[${m.created_at}] ID: ${m.id} | Dir: ${m.direction} | Status: ${m.status} | Content: ${m.content}`);
      if (m.status === 'failed') {
          console.log(`-> ERRO: ${m.error_message}`);
          console.log(`-> RAW:`, m.raw_payload);
      }
      console.log('---');
  }
}
run();

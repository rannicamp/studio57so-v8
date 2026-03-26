import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: failedMsgs } = await supabaseAdmin.from('whatsapp_messages')
    .select('id, content, status, raw_payload, error_message, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("=== ÚLTIMAS FALHAS (INCLUINDO A DAS 10:24) ===");
  for (const msg of failedMsgs) {
      console.log(`[${msg.created_at}] ID: ${msg.id}`);
      console.log(`ERROR: ${msg.error_message}`);
      // parse raw_payload se for json string
      try {
          const payload = typeof msg.raw_payload === 'string' ? JSON.parse(msg.raw_payload) : msg.raw_payload;
          console.log(`PAYLOAD ERROR CODE:`, payload?.error?.code, payload?.error?.message);
          console.log(`RAW JSON:`, JSON.stringify(payload, null, 2).substring(0, 300));
      } catch(e) { console.log(msg.raw_payload); }
      console.log("-----------------------------------------");
  }
}
run();

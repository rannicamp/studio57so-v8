import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: failedMsgs } = await supabase.from('whatsapp_messages')
    .select('id, content, status, error_message, raw_payload, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log("=== ÚLTIMAS MENSAGENS FALHAS ===");
  console.log(JSON.stringify(failedMsgs, null, 2));

  const { data: config } = await supabase.from('configuracoes_whatsapp')
    .select('whatsapp_business_account_id, whatsapp_phone_number_id, env_waba_id, env_phone_id')
    .eq('organizacao_id', 2)
    .single();
    
  console.log("\n=== CONFIGURAÇÃO ORG 2 ===");
  console.log(config);
}
run();

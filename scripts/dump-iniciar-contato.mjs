import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: config } = await supabaseAdmin
    .from('configuracoes_whatsapp')
    .select('whatsapp_permanent_token, whatsapp_business_account_id')
    .eq('organizacao_id', 2)
    .single();

  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || config.whatsapp_permanent_token;
  const wabaId = config.whatsapp_business_account_id;

  const url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?fields=name,status,category,language,components&limit=100`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  
  if (data.data) {
      const target = data.data.find(t => t.name === 'iniciar_contato');
      console.log("=== INICIAR_CONTATO COMPONENTS ===");
      console.log(JSON.stringify(target.components, null, 2));
  }
}
run();

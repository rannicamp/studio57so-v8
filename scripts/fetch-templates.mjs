import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: config } = await supabase.from('configuracoes_whatsapp').select('*').eq('organizacao_id', 2).single();
  
  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN;
  const wabaId = config.whatsapp_business_account_id;
  
  const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  const init = data.data.find(t => t.name === 'iniciar_contato');
  console.log("TEMPLATE iniciar_contato:");
  console.log(JSON.stringify(init, null, 2));

  const novo = data.data.find(t => t.name === 'novo_lead_beta_eua');
  console.log("\nTEMPLATE novo_lead_beta_eua:");
  console.log(JSON.stringify(novo, null, 2));
}
test();

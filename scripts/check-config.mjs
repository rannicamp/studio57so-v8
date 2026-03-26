import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: config } = await supabase.from('configuracoes_whatsapp').select('organizacao_id, whatsapp_phone_number_id');
  console.log("Configurações WhatsApp no Banco:", config);

  const { data: msgs, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (error) console.error("Erro msgs:", error);
  else console.log("Últimas mensagens salvas:", msgs);
}
check();

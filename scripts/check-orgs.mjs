import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: org1 } = await supabase
    .from('whatsapp_messages')
    .select('id, created_at, content, direction')
    .eq('organizacao_id', 1)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: org2 } = await supabase
    .from('whatsapp_messages')
    .select('id, created_at, content, direction')
    .eq('organizacao_id', 2)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log("--- MENSAGENS NA ORG 1 (MATRIZ) ---");
  console.log(org1);
  
  console.log("\n--- MENSAGENS NA ORG 2 (FILIAL/TESTE) ---");
  console.log(org2);
}

check();

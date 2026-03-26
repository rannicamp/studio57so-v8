import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { error: err1 } = await supabase.from('whatsapp_conversations').update({ organizacao_id: 2 }).eq('id', 10202);
  const { error: err2 } = await supabase.from('contatos').update({ organizacao_id: 2 }).eq('id', 5071);
  
  if (err1 || err2) console.error("Erros:", err1, err2);
  else console.log("✔️ Conversa 10202 e Contato 5071 movidos com sucesso para a Org 2!");
}
fix();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== Aplicando Regra Global de Org 2 ===");
  await supabase.from('whatsapp_messages').update({ organizacao_id: 2 }).neq('organizacao_id', 2);
  await supabase.from('whatsapp_conversations').update({ organizacao_id: 2 }).neq('organizacao_id', 2);
  await supabase.from('contatos').update({ organizacao_id: 2 }).neq('organizacao_id', 2);
  console.log("✔️ Todos os dados de WhatsApp e Contatos movidos para Org 2.");

  // Investigando o lead 553391912291
  const { data: leadConv } = await supabase.from('whatsapp_conversations')
    .select('*, contatos(*)')
    .order('updated_at', { ascending: false }).limit(2);
    
  console.log("\nÚltima Conversa:");
  console.log(JSON.stringify(leadConv, null, 2));

  if (leadConv && leadConv.length > 0) {
      const convId = leadConv[0].id;
      const { data: msgs } = await supabase.from('whatsapp_messages')
        .select('id, content, direction, conversation_record_id, contato_id')
        .eq('conversation_record_id', convId);
      console.log(`\nMensagens ATRELADAS NA CONVERSA ${convId}:`, msgs);
      
      const { data: looseMsgs } = await supabase.from('whatsapp_messages')
        .select('id, content, direction, conversation_record_id, contato_id')
        .eq('to_number', '553391912291')
        .is('conversation_record_id', null);
      console.log("\nMensagens SOLTAS para o número:", looseMsgs);
  }
}
run();

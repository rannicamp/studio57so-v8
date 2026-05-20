require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Encontrar a última mensagem recebida (inbound) na conversa 9042
  const { data: lastInbound } = await supabase
    .from('whatsapp_messages')
    .select('created_at')
    .eq('conversation_record_id', 9042)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (lastInbound) {
    console.log("Última mensagem inbound:", lastInbound.created_at);
    // Atualizar o customer_window_start_at da conversa 9042
    await supabase
      .from('whatsapp_conversations')
      .update({ customer_window_start_at: lastInbound.created_at })
      .eq('id', 9042);
    console.log("Conversa 9042 atualizada com o cronômetro correto!");
  } else {
    console.log("Nenhuma mensagem inbound encontrada.");
  }
}
run();

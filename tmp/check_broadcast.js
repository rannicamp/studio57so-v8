const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBroadcasts() {
  console.log("Buscando o último disparo (scheduled_broadcasts)...");
  const { data: broadcasts, error: bErr } = await supabase
    .from('whatsapp_scheduled_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (bErr) console.error(bErr);
  else console.log(broadcasts);

  console.log("\nBuscando as últimas mensagens enviadas hoje (whatsapp_messages)...");
  
  // Buscar a lista do último broadcast (se existir)
  if (broadcasts && broadcasts.length > 0) {
     const lastBroadcast = broadcasts[0];
     console.log(`\nAnalisando o disparo: ${lastBroadcast.name} (ID: ${lastBroadcast.id})`);
     
     // messages might be linked to the broadcast_id somehow, but let's just see recent ones
  }
  
  // As mensagens podem não estar vinculadas diretamente, vamos buscar pelas de hoje, originadas por 'system' ou enviadas recentemente
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: msgs, error: mErr } = await supabase
    .from('whatsapp_messages')
    .select('id, to_number, status, created_at, message_type')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (mErr) {
    console.error(mErr);
  } else {
    console.log(`\nMensagens criadas na última hora: ${msgs.length}`);
    const statusCounts = msgs.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});
    console.log("Resumo por status:", statusCounts);
  }
  
  // Check the list members count to see how many were supposed to be sent
  if (broadcasts && broadcasts.length > 0 && broadcasts[0].list_id) {
      const { count } = await supabase
        .from('whatsapp_list_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', broadcasts[0].list_id);
      console.log(`\nA lista alvo do último disparo (ID: ${broadcasts[0].list_id}) tem um total de ${count} membros.`);
  }
}

checkBroadcasts();

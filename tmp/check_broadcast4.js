const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data: lists } = await supabase.from('whatsapp_broadcast_lists').select('*').order('created_at', { ascending: false }).limit(3);
  console.log("Últimas Listas:", lists);

  if (lists && lists.length > 0) {
      const listId = lists[0].id;
      const { data: members } = await supabase.from('whatsapp_list_members').select('*').eq('list_id', listId).limit(2);
      console.log(`Membros da lista ${listId}:`, members);
      
      const { count: totalMembers } = await supabase.from('whatsapp_list_members').select('*', { count: 'exact', head: true }).eq('list_id', listId);
      console.log(`Total de membros na lista ${listId}: ${totalMembers}`);
  }

  // buscar os ultimos broadcasts disparados
  const { data: bcast } = await supabase.from('whatsapp_scheduled_broadcasts').select('*').order('created_at', { ascending: false }).limit(3);
  console.log("\nÚltimos Broadcasts (whatsapp_scheduled_broadcasts):", bcast);
}

inspect();

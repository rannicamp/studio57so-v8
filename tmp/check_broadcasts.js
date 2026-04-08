import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching last 3 broadcasts...");
  const { data: broadcasts, error: broadcastError } = await supabase
    .from('whatsapp_scheduled_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (broadcastError) {
    console.error("Error fetching broadcasts:", broadcastError);
    return;
  }

  for (const b of broadcasts) {
    console.log(`\nBroadcast ID: ${b.id} | Status: ${b.status} | Created: ${b.created_at} | Template: ${b.template_name}`);
    
    const { data: messages, error: msgError } = await supabase
      .from('whatsapp_messages')
      .select('id, status, raw_payload')
      .eq('broadcast_id', b.id);
      
    if (msgError) {
       console.error("...error fetching messages", msgError);
    } else {
       console.log(`   -> Total Messages tracked: ${messages.length}`);
       const statusCounts = {};
       for (const m of messages) {
         statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
       }
       console.log(`   -> Status counts:`, statusCounts);
       
       if (messages.length === 0) {
           console.log("   -> NO MESSAGES INSERTED FOR THIS BROADCAST.");
       }
    }
    
    // Check members of the list
    const { data: members } = await supabase
      .from('whatsapp_list_members')
      .select('contato_id')
      .eq('lista_id', b.lista_id);
    
    console.log(`   -> List ${b.lista_id} has ${members ? members.length : 0} members.`);
  }
}

run();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Update conversation
  const { error: e1 } = await supabase
    .from('whatsapp_conversations')
    .update({ phone_number: '16177972581' })
    .eq('id', 14986);
    
  if (e1) console.error("Error updating conversation:", e1);
  else console.log("Conversation updated successfully.");

  // Update messages
  const { error: e2 } = await supabase
    .from('whatsapp_messages')
    .update({ receiver_id: '16177972581' })
    .eq('conversation_record_id', 14986);
    
  if (e2) console.error("Error updating messages:", e2);
  else console.log("Messages updated successfully.");
}

run().catch(console.error);

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .limit(1);
    
  if (error) console.error(error);
  else console.log(Object.keys(data[0]));
}
run();

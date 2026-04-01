require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tickets, error } = await supabase
    .from('notificacoes')
    .select('link');

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  const uniqueLinks = [...new Set(tickets.map(t => t.link))];
  console.log('Unique Links in notificacoes:', uniqueLinks);
}

run().catch(console.error);

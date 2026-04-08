import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: broadcasts } = await supabase
    .from('whatsapp_scheduled_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  broadcasts.forEach(b => {
    console.log(`\n=======================`);
    console.log(`ID: ${b.id}`);
    console.log(`Created: ${b.created_at}`);
    console.log(`Template: ${b.template_name}`);
    console.log(`Variables:`, b.variables);
    console.log(`Components:`, b.components ? JSON.stringify(b.components) : null);
  });
}

run();

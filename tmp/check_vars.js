import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVariables() {
  const { data: b } = await supabase.from('whatsapp_scheduled_broadcasts').select('id, template_name, variables, components').order('created_at', { ascending: false }).limit(1).single();
  console.log("Último Broadcast:", b);
}

checkVariables();

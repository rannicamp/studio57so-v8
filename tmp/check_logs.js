
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  console.log('Verificando tabelas de log...');
  // Primeira tentativa: tabela 'logs'
  let { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(5);
  
  if (error) {
     console.log('Erro na tabela logs:', error.message);
     // Segunda tentativa: 'system_logs'
     let res2 = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(5);
     if (res2.error) {
       console.log('Erro system_logs:', res2.error.message);
       // Terceira tentativa: 'activity_logs'
       let res3 = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5);
       if (res3.error) console.log('Erro activity_logs:', res3.error.message);
       else console.log('Resultados activity_logs:', res3.data);
     } else {
       console.log('Resultados system_logs:', res2.data);
     }
  } else {
    console.log('Resultados logs:', data);
  }
}
checkLogs();


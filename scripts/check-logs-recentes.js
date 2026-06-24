const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
  console.log('=== BUSCANDO ÚLTIMOS 20 LOGS DO SISTEMA ===');
  const { data: logs, error } = await supabase
    .from('app_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao buscar logs:', error.message);
    return;
  }

  logs.forEach(l => {
    console.log(`[${new Date(l.created_at).toLocaleString('pt-BR')}] [${l.origem}] ${l.mensagem}`);
    if (l.payload) {
      console.log(`   Payload: ${JSON.stringify(l.payload).substring(0, 300)}`);
    }
  });
}

checkLogs().catch(console.error);

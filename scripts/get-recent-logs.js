const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== LENDO LOGS RECENTES (ÚLTIMOS 30 MINUTOS) ===');
  
  const trintaMinutosAtras = new Date();
  trintaMinutosAtras.setMinutes(trintaMinutosAtras.getMinutes() - 30);

  const { data: logs, error } = await supabase
    .from('app_logs')
    .select('created_at, origem, mensagem, payload')
    .gte('created_at', trintaMinutosAtras.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar logs:', error.message);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log('Nenhum log recente encontrado.');
    return;
  }

  logs.forEach(l => {
    const date = new Date(l.created_at).toLocaleString('pt-BR');
    console.log(`[${date}] [${l.origem}] ${l.mensagem}`);
    if (l.payload && Object.keys(l.payload).length > 0) {
      console.log('  Payload:', JSON.stringify(l.payload, null, 2));
    }
    console.log('----------------------------------------------------');
  });
}

run().catch(console.error);

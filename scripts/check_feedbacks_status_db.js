require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('Pesquisando aglomerados de Status na tabela Feedback...');
  
  // Pegando todos os registros e fazendo um agrupamento no lado do JS 
  // caso o count distinc nao esteja claro na API nativa do supabse js
  const { data, error } = await supabase.from('feedback').select('id, status');
  
  if (error) {
    console.error('Erro ao ler feedbacks:', error);
    return;
  }

  const agrupamento = data.reduce((acc, curr) => {
    const s = curr.status || 'Nulo/Sem Status';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Resumo dos Status de Feedback no Banco de Dados:');
  console.table(agrupamento);
}

run().catch(console.error);

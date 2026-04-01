require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tickets, error } = await supabase
    .from('feedback')
    .select('*')
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  console.log('Pendentes count:', tickets.length);
  if (tickets.length > 0) {
    console.log('Tickets:', JSON.stringify(tickets, null, 2));

    // For each ticket, try to get user and org manually
    for (const t of tickets) {
      if (t.usuario_id) {
        // try to get from funcionarios
        const { data: func } = await supabase.from('funcionarios').select('nome').eq('user_id', t.usuario_id).single();
        if (func) t.usuario_nome = func.nome;
      }
      if (t.organizacao_id) {
        const { data: org } = await supabase.from('cadastro_empresa').select('nome_fantasia').eq('id', t.organizacao_id).single();
        if (org) t.organizacao_nome = org.nome_fantasia;
      }
    }
    console.log('Tickets ENRICHED:', JSON.stringify(tickets, null, 2));
  }
}

run().catch(console.error);

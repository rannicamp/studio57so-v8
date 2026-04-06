require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function getNewTickets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('feedback')
    .select(`
      id, pagina, descricao, imagem_url, status, diagnostico, 
      auth_users:usuario_id(raw_user_meta_data)
    `)
    .in('status', ['Novo', 'Em Análise'])
    .is('diagnostico', null);

  if (error) {
    fs.writeFileSync('tmp_tickets.json', JSON.stringify({error: error}));
  } else {
    fs.writeFileSync('tmp_tickets.json', JSON.stringify(data, null, 2));
  }
}
getNewTickets();

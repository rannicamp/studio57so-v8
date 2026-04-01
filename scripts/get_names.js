require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function getNames() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Ticket 84
  const { data: user84auth } = await supabase.auth.admin.getUserById('4046a5ad-f198-4309-99ab-3b8fed59cad1');
  const { data: func84 } = await supabase.from('funcionarios').select('nome').eq('user_id', '4046a5ad-f198-4309-99ab-3b8fed59cad1').single();
  const userName84 = user84auth?.user?.user_metadata?.first_name || func84?.nome || 'Usuário Desconhecido';

  // Ticket 85
  const { data: user85auth } = await supabase.auth.admin.getUserById('e48b4e12-afa9-4672-b56b-45e5c9a8fd5a');
  const { data: func85 } = await supabase.from('funcionarios').select('nome').eq('user_id', 'e48b4e12-afa9-4672-b56b-45e5c9a8fd5a').single();
  const userName85 = user85auth?.user?.user_metadata?.first_name || func85?.nome || 'Usuário Desconhecido';

  const { data: org } = await supabase.from('cadastro_empresa').select('nome_fantasia').eq('id', 2).single();
  const orgName = org?.nome_fantasia || 'Organização 2';

  console.log('Ticket 84 user:', userName84);
  console.log('Ticket 85 user:', userName85);
  console.log('Org:', orgName);
}

getNames().catch(console.error);

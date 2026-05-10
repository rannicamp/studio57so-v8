const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: integracoes } = await supabase.from('integracoes_google')
    .select('*')
    .eq('tipo_conexao', 'contatos')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!integracoes || integracoes.length === 0) {
    console.log('Nenhuma integracao.');
    return;
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: integracoes[0].access_token,
    refresh_token: integracoes[0].refresh_token,
  });

  const peopleService = google.people({ version: 'v1', auth: oauth2Client });

  try {
    const res = await peopleService.people.searchContacts({
      query: 'Lead Teste',
      readMask: 'names,emailAddresses,phoneNumbers',
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();

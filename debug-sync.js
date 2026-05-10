const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSync() {
  const { data: contatos } = await supabase.from('contatos').select('*').limit(1);
  if (!contatos || contatos.length === 0) return console.log('No contatos');

  const orgId = contatos[0].organizacao_id;
  
  const { data: integracoes } = await supabase
      .from('integracoes_google')
      .select('*')
      .eq('tipo_conexao', 'contatos')
      .eq('is_active', true)
      .eq('organizacao_id', orgId);

  if (!integracoes || integracoes.length === 0) return console.log('No integracoes');
  
  const integracao = integracoes[0];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: integracao.access_token,
    refresh_token: integracao.refresh_token,
  });

  const peopleService = google.people({ version: 'v1', auth: oauth2Client });

  const payloadGoogle = {
    nome: contatos[0].nome || 'Sem Nome',
    telefone: '+55 11 99999-9999',
    email: 'teste@elo57.com.br',
    empresa: 'Studio 57',
    tipo_contato: 'Lead'
  };

  const { createContact } = require('./lib/googleContacts');

  try {
    const res = await createContact({
      accessToken: integracao.access_token,
      refreshToken: integracao.refresh_token,
      contatoData: payloadGoogle
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('Error on createContact:', err);
  }
}

testSync();

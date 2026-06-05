const { createClient } = require('c:/Projetos/studio57so-v8/node_modules/@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('c:/Projetos/studio57so-v8/node_modules/dotenv');

if (fs.existsSync('c:/Projetos/studio57so-v8/.env.local')) {
  dotenv.config({ path: 'c:/Projetos/studio57so-v8/.env.local' });
} else if (fs.existsSync('c:/Projetos/studio57so-v8/.env')) {
  dotenv.config({ path: 'c:/Projetos/studio57so-v8/.env' });
}

async function debug() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const contatoId = 5738;
  console.log('Buscando contato 5738 no Supabase...');
  
  const { data: contato, error } = await adminClient
    .from('contatos')
    .select('ia_atendimento_ativo, telefone')
    .eq('id', contatoId)
    .single();

  if (error) {
    console.error('Erro na query:', error);
  } else {
    console.log('Dados do contato retornado:', contato);
  }
}

debug();

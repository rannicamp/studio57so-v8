// scratch/investigar_instagram_db.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== TESTANDO COM O TOKEN DE INTEGRAÇÃO REAL DA ORG 2 ===");

  // Buscar a integração id = 5
  const { data: integracao, error: errI } = await supabase
    .from('integracoes_meta')
    .select('page_access_token, instagram_business_account_id')
    .eq('id', 5)
    .single();

  if (errI || !integracao) {
    console.error("Erro ao buscar integracao ID 5:", errI?.message || "Não encontrada");
    return;
  }

  const token = integracao.page_access_token;
  console.log("Token carregado. Tamanho:", token.length);
  console.log("Token preview:", token.substring(0, 15) + '...');

  // Testar com o ID do participante de teste (1177681900998676)
  const participantId = '1177681900998676';
  
  console.log(`\nChamando Graph API para participante ${participantId}...`);
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${participantId}?fields=name,username,profile_pic&access_token=${token}`
    );

    console.log(`Status de retorno: ${profileRes.status} (${profileRes.statusText})`);
    const resData = await profileRes.json();
    console.log("Resposta da Meta API:");
    console.log(JSON.stringify(resData, null, 2));

  } catch (err) {
    console.error("Erro na requisição:", err.message);
  }
}

main();

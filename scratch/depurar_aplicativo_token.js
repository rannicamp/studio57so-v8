// scratch/depurar_aplicativo_token.js
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
  console.log("=== DESCOBRINDO QUAL APLICATIVO GEROU O TOKEN DO INSTAGRAM ===");

  // 1. Buscar o token da integracao ID 5
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

  // 2. Chamar o endpoint /app da Meta para ver o aplicativo associado ao token
  console.log(`Chamando Meta API: https://graph.facebook.com/v21.0/app...`);
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/app?access_token=${token}`);
    
    console.log(`Status de retorno: ${res.status} (${res.statusText})`);
    const data = await res.json();
    console.log("Informações do Aplicativo da Meta:");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Erro ao fazer requisição:", err.message);
  }
}

main();

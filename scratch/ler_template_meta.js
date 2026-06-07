const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ 
    connectionString: 'postgres://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  try {
    // 1. Buscar credenciais da organização 2 (Studio 57)
    const { rows: configs } = await client.query(`
      SELECT whatsapp_permanent_token, whatsapp_business_account_id 
      FROM public.configuracoes_whatsapp 
      WHERE organizacao_id = 2
      LIMIT 1
    `);

    if (!configs || configs.length === 0) {
      console.log("Configuração não encontrada no banco.");
      return;
    }

    const { whatsapp_permanent_token, whatsapp_business_account_id } = configs[0];
    const WHATSAPP_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || whatsapp_permanent_token;
    const WHATSAPP_BUSINESS_ACCOUNT_ID = whatsapp_business_account_id;

    if (!WHATSAPP_BUSINESS_ACCOUNT_ID || !WHATSAPP_TOKEN) {
      console.log("Credenciais incompletas.");
      return;
    }

    console.log(`Buscando templates para WABA: ${WHATSAPP_BUSINESS_ACCOUNT_ID}`);

    // 2. Chamar a API da Meta Graph para listar os templates
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Erro na API da Meta:", data);
      return;
    }

    const templates = data.data || [];
    const target = templates.find(t => t.name === 'saudacao_entrada_v2');

    if (target) {
      console.log("\n=== TEMPLATE ENCONTRADO ===");
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log("\nTemplate 'saudacao_entrada_v2' não encontrado. Lista de nomes disponíveis:");
      console.log(templates.map(t => t.name));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();

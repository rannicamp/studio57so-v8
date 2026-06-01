const { Client } = require('pg');

async function testTemplatesAPI() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  // Buscar configurações da Org 2
  const res = await client.query(`
    SELECT whatsapp_business_account_id, whatsapp_permanent_token
    FROM configuracoes_whatsapp
    WHERE organizacao_id = '2' AND whatsapp_business_account_id IS NOT NULL
    LIMIT 1;
  `);

  if (res.rows.length === 0) {
    console.error("Nenhuma configuração de WhatsApp ativa para Org 2.");
    await client.end();
    return;
  }

  const { whatsapp_business_account_id, whatsapp_permanent_token } = res.rows[0];

  console.log(`Buscando templates da conta de business: ${whatsapp_business_account_id}`);

  // Chamar API de templates
  const url = `https://graph.facebook.com/v20.0/${whatsapp_business_account_id}/message_templates?limit=10&access_token=${whatsapp_permanent_token}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("Templates Encontrados:");
    data.data.forEach(t => {
      console.log(`\nTemplate: ${t.name} (${t.language}) [Status: ${t.status}]`);
      t.components.forEach(c => {
        console.log(` - Component [${c.type}]: ${c.text || c.format || '(No text)'}`);
      });
    });
  } catch (error) {
    console.error("Erro ao buscar templates:", error);
  }

  await client.end();
}

testTemplatesAPI();

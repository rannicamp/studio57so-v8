const { Client } = require('pg');

async function testTemplate() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  // Buscar configurações da Org 2
  const res = await client.query(`
    SELECT whatsapp_phone_number_id, whatsapp_permanent_token
    FROM configuracoes_whatsapp
    WHERE organizacao_id = '2' AND whatsapp_phone_number_id IS NOT NULL
    LIMIT 1;
  `);

  if (res.rows.length === 0) {
    console.error("Nenhuma configuração de WhatsApp ativa para Org 2.");
    await client.end();
    return;
  }

  const { whatsapp_phone_number_id, whatsapp_permanent_token } = res.rows[0];

  const templateName = 'saudacao_entrada_v2';
  const language = 'pt_BR';
  const to = '5533997325772'; // Número da Janice ou qualquer um para teste
  const nomeExibicao = 'Cliente Teste';

  console.log(`Disparando chamada de teste para Meta API...`);
  console.log(`Remetente (Phone ID): ${whatsapp_phone_number_id}`);
  console.log(`Destinatário: ${to}`);
  console.log(`Template: ${templateName} (${language})`);

  const url = `https://graph.facebook.com/v20.0/${whatsapp_phone_number_id}/messages`;
  
  const components = [{
    type: 'body',
    parameters: [{ type: 'text', text: nomeExibicao }]
  }];

  let payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: components
    }
  };

  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whatsapp_permanent_token}`
      },
      body: JSON.stringify(payload)
    });
    
    let responseData = await response.json();
    console.log("\nPrimeira tentativa - Status:", response.status);
    console.log("Primeira tentativa - Data:", JSON.stringify(responseData, null, 2));

    // Auto-heal
    if (!response.ok && responseData.error?.code === 132000) {
      console.log("\n⚠️ [Auto-Heal Triggered] Erro 132000 detectado! Reenviando sem componentes/parâmetros...");
      payload.template.components = [];

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whatsapp_permanent_token}`
        },
        body: JSON.stringify(payload)
      });

      responseData = await response.json();
      console.log("\nSegunda tentativa - Status:", response.status);
      console.log("Segunda tentativa - Data:", JSON.stringify(responseData, null, 2));
    }

  } catch (error) {
    console.error("Erro na chamada Fetch:", error);
  }

  await client.end();
}

testTemplate();

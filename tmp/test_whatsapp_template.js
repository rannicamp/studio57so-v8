const { Client } = require('pg');

async function checkTemplateNeedsVariables(config, templateName) {
  try {
    const url = `https://graph.facebook.com/v20.0/${config.whatsapp_business_account_id}/message_templates?name=${templateName}&access_token=${config.whatsapp_permanent_token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[WhatsApp] Falha ao consultar template '${templateName}' na Meta API (Status: ${res.status}). Usando fallback = true.`);
      return true; 
    }
    const data = await res.json();
    const template = data.data?.find(t => t.name === templateName);
    if (!template) {
      console.warn(`[WhatsApp] Template '${templateName}' não encontrado no retorno da Meta API. Usando fallback = true.`);
      return true; 
    }

    // Verifica se algum componente de texto tem {{1}}
    let hasVariable = false;
    (template.components || []).forEach(comp => {
      if (comp.text && comp.text.includes('{{1}}')) {
        hasVariable = true;
      }
    });
    return hasVariable;
  } catch (err) {
    console.error(`[WhatsApp] Erro ao verificar estrutura do template '${templateName}':`, err);
    return true; 
  }
}

async function testTemplate(templateName) {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  // Buscar configurações da Org 2
  const res = await client.query(`
    SELECT whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_permanent_token
    FROM configuracoes_whatsapp
    WHERE organizacao_id = '2' AND whatsapp_phone_number_id IS NOT NULL
    LIMIT 1;
  `);

  if (res.rows.length === 0) {
    console.error("Nenhuma configuração de WhatsApp ativa para Org 2.");
    await client.end();
    return;
  }

  const config = res.rows[0];
  const { whatsapp_phone_number_id, whatsapp_permanent_token } = config;

  const language = 'pt_BR';
  const to = '5533997325772'; // Número da Janice
  const nomeExibicao = 'Cliente Teste';

  console.log(`\n--- Testando Template: ${templateName} ---`);
  
  // 1. Verificar preventivamente se o template precisa de variáveis
  const needsVariables = await checkTemplateNeedsVariables(config, templateName);
  console.log(`Precisa de variáveis? ${needsVariables}`);

  const components = [];
  if (needsVariables) {
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: nomeExibicao }]
    });
  }

  const url = `https://graph.facebook.com/v20.0/${whatsapp_phone_number_id}/messages`;
  
  let payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateName === 'iniciar_contato' ? 'en' : language },
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
    console.log("Resultado - Status:", response.status);
    console.log("Resultado - Data:", JSON.stringify(responseData, null, 2));

    // Fallback Auto-heal (caso a verificação preventiva dê erro ou não cubra algo)
    if (!response.ok && responseData.error?.code === 132000) {
      console.log("⚠️ [Auto-Heal Triggered] Erro 132000 detectado! Reenviando sem componentes/parâmetros...");
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
      console.log("Auto-heal Resultado - Status:", response.status);
    }

  } catch (error) {
    console.error("Erro na chamada Fetch:", error);
  }

  await client.end();
}

async function run() {
  await testTemplate('saudacao_entrada_v2'); // Sem variáveis
  await testTemplate('iniciar_contato');     // Com variáveis (en)
}

run();

const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Garantindo que ia_atendimento_ativo está true para o Ranniere (5598)...');
  await client.query(`
    UPDATE contatos 
    SET ia_atendimento_ativo = true 
    WHERE id = 5598;
  `);

  console.log('Disparando simulação de webhook de localização...');
  const payload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15550000000",
                "phone_number_id": "690198827516149"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "Ranniere Campos Mendes"
                  },
                  "wa_id": "5533991912291"
                }
              ],
              "messages": [
                {
                  "from": "5533991912291",
                  "id": "wamid.AUTOPILOT_LOC_" + Date.now(),
                  "timestamp": Math.floor(Date.now() / 1000).toString(),
                  "text": {
                    "body": "Qual a localização?"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Resposta imediata do Webhook:', data);
  } catch (error) {
    console.error('Erro ao chamar webhook:', error);
  }

  // Espera 30 segundos para permitir a Stella processar em background
  console.log('Aguardando 30 segundos para a Stella processar em background...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await client.end();
  console.log('Fim do script de teste!');
}

main();

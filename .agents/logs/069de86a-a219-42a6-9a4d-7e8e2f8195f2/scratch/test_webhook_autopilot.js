async function runWebhookTest() {
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
                    "name": "Fernanda Alves de Oliveira"
                  },
                  "wa_id": "5522997829989"
                }
              ],
              "messages": [
                {
                  "from": "5522997829989",
                  "id": "wamid.TEST_AUTOPILOT_" + Date.now(),
                  "timestamp": Math.floor(Date.now() / 1000).toString(),
                  "text": {
                    "body": "Gostaria de ver as opções e o book do Residencial Alfa por favor?"
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

  console.log('Disparando simulação de webhook...');
  try {
    const response = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Resposta do Webhook:', data);
  } catch (error) {
    console.error('Erro ao chamar webhook:', error);
  }
}

runWebhookTest();

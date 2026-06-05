async function runWebhookTest() {
  const msgId = "wamid.PROD_TEST_" + Date.now();
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
                  "id": msgId,
                  "timestamp": Math.floor(Date.now() / 1000).toString(),
                  "text": {
                    "body": "Quais os próximos passos?"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ],
    "object": "whatsapp_business_account"
  };

  console.log(`Disparando simulação de webhook de produção com ID de mensagem: ${msgId}...`);
  try {
    const response = await fetch('https://studio57.arq.br/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('Resposta do Webhook de Produção (Status:', response.status, '):');
    console.log(text);
  } catch (error) {
    console.error('Erro ao chamar webhook de produção:', error);
  }
}

runWebhookTest();

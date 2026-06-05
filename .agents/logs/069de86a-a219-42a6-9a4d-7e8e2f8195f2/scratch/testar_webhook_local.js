const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const contato_id = 5598;
  const organizacao_id = 2;
  const telefone_cliente = '5533991912291';

  console.log('=== SIMULANDO WEBHOOK DO RANNIERE LOCALMENTE ===\n');

  try {
    // 1. Limpar mensagens de teste anteriores
    console.log('Limpando mensagens anteriores...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);

    const configRes = await client.query('SELECT whatsapp_phone_number_id FROM public.configuracoes_whatsapp WHERE organizacao_id = $1 LIMIT 1;', [organizacao_id]);
    if (configRes.rows.length === 0) {
      console.error('Configuração do WhatsApp não encontrada.');
      await client.end();
      return;
    }
    const phone_number_id = configRes.rows[0].whatsapp_phone_number_id;

    // 2. Montar o payload de áudio do Ranniere
    const msgId = 'wamid.TEST_AUDIO_RANNIERE_' + Date.now();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '5533991912291', phone_number_id: phone_number_id },
            contacts: [{ profile: { name: 'Ranniere Teste' }, wa_id: telefone_cliente }],
            messages: [{
              from: telefone_cliente,
              id: msgId,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'audio',
              audio: {
                mime_type: 'audio/ogg; codecs=opus',
                sha256: 'xyz',
                id: '12345678'
              }
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('Enviando requisição POST para o webhook local...');
    const response = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`Resposta do webhook local: Status ${response.status}`);
    const data = await response.json();
    console.log('Retorno:', data);

  } catch (err) {
    console.error('Erro ao simular webhook:', err.message);
  }

  await client.end();
}

main();

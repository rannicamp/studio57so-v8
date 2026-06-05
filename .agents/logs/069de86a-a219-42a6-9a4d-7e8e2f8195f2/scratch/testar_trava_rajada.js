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

  console.log('=== TESTE DE DEBOUNCE DE RAJADA (4 SEGUNDOS) ===\n');

  try {
    // 1. Limpar mensagens antigas do contato de teste e obter o phone_number_id do banco
    console.log('Limpando mensagens antigas...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);

    const configRes = await client.query('SELECT whatsapp_phone_number_id FROM public.configuracoes_whatsapp WHERE organizacao_id = $1 LIMIT 1;', [organizacao_id]);
    if (configRes.rows.length === 0) {
      console.error('Configuração do WhatsApp não encontrada.');
      await client.end();
      return;
    }
    const phone_number_id = configRes.rows[0].whatsapp_phone_number_id;
    console.log(`Phone Number ID configurado para a organização 2: ${phone_number_id}\n`);

    // 2. Simular a primeira mensagem inbound enviada pelo cliente ("Oi, boa tarde")
    const msgId1 = 'wamid.TEST_DEB_MSG_1_' + Date.now();
    const payload1 = {
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
              id: msgId1,
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: 'Oi, boa tarde' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('Disparando Chamada 1 para o Webhook local (esperamos debounce de 4s)...');
    const p1 = fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    }).then(async r => {
      console.log(`[Chamada 1] Status: ${r.status}`);
      return r.json();
    });

    // Simulamos que 2 segundos depois, o cliente envia a segunda mensagem inbound ("quais os empreendimentos")
    // Isso deve ocorrer DURANTE a janela de debounce de 4s da primeira chamada!
    await new Promise(resolve => setTimeout(resolve, 2000));

    const msgId2 = 'wamid.TEST_DEB_MSG_2_' + Date.now();
    const payload2 = {
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
              id: msgId2,
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: 'Gostaria de saber quais os empreendimentos disponíveis' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('Disparando Chamada 2 para o Webhook local (rajada)...');
    const p2 = fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2)
    }).then(async r => {
      console.log(`[Chamada 2] Status: ${r.status}`);
      return r.json();
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    console.log('\n--- Resultados das Chamadas ---');
    console.log('Chamada 1 (Antiga - deve ser ignorada):', res1);
    console.log('Chamada 2 (Nova - deve processar a resposta):', res2);
    console.log('Esperado na Chamada 1: { status: "ok", detail: "ignored_older_inbound_during_debounce" }');
    console.log('Esperado na Chamada 2: { status: "ok" }\n');

    // Aguardar mais uns segundos para a chamada de envio de texto e anexo terminar localmente
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Limpeza final do contato de teste
    console.log('Limpando mensagens do teste...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);

  } catch (err) {
    console.error('Erro no script de teste:', err.message);
  }

  await client.end();
  console.log('Teste de debounce de rajada concluído.');
}

main();

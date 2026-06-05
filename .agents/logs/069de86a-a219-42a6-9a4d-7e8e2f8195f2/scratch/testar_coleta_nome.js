const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const telefone_cliente = '5533999999999';
  console.log('=== TESTE DE COLETA DE NOME E ATUALIZAÇÃO CRM ===\n');

  try {
    // 1. Obter a configuração do WhatsApp da organização 2
    const configRes = await client.query('SELECT whatsapp_phone_number_id FROM public.configuracoes_whatsapp WHERE organizacao_id = 2 LIMIT 1;');
    if (configRes.rows.length === 0) {
      console.error('Configuração do WhatsApp não encontrada.');
      await client.end();
      return;
    }
    const phone_number_id = configRes.rows[0].whatsapp_phone_number_id;

    // 2. Garantir que o contato de teste existe com o nome genérico "Lead (5533999999999)"
    console.log('Limpando contato antigo se houver...');
    const existingContactRes = await client.query('SELECT id FROM public.contatos WHERE nome ILIKE $1 AND organizacao_id = 2 LIMIT 1;', [`%${telefone_cliente}%`]);
    let contato_id;

    if (existingContactRes.rows.length > 0) {
      contato_id = existingContactRes.rows[0].id;
      console.log(`Reutilizando contato existente (ID: ${contato_id}) e resetando nome para genérico...`);
      await client.query('UPDATE public.contatos SET nome = $1, ia_atendimento_ativo = true WHERE id = $2;', [`Lead (${telefone_cliente})`, contato_id]);
      await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
      await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);
    } else {
      console.log('Criando novo contato genérico...');
      const insertContactRes = await client.query(`
        INSERT INTO public.contatos (nome, tipo_contato, ia_atendimento_ativo, organizacao_id) 
        VALUES ($1, 'Lead', true, 2) 
        RETURNING id;
      `, [`Lead (${telefone_cliente})`]);
      contato_id = insertContactRes.rows[0].id;

      await client.query(`
        INSERT INTO public.telefones (contato_id, telefone, tipo, organizacao_id) 
        VALUES ($1, $2, 'celular', 2);
      `, [contato_id, telefone_cliente]);
    }

    // --- RODADA 1: Enviar "Oi, gostaria de mais informações" ---
    // Esperamos que a Stella se apresente e PERGUNTE o nome do cliente, já que o nome cadastrado é "Lead (5533999999999)".
    const msgId1 = 'wamid.TEST_NAME_MSG_1_' + Date.now();
    const payload1 = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553398192119', phone_number_id: phone_number_id },
            contacts: [{ profile: { name: 'Cliente Desconhecido' }, wa_id: telefone_cliente }],
            messages: [{
              from: telefone_cliente,
              id: msgId1,
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: 'Oi, gostaria de mais informações' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('Disparando Chamada 1 (Cliente diz Oi)...');
    const r1 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    });
    console.log(`Resposta do webhook 1: Status ${r1.status}`);

    // Esperar um tempo para a Stella rodar e mandar a resposta de texto no background
    console.log('Aguardando 12 segundos para a Stella responder e salvar no banco...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Verificar no banco a última mensagem enviada pela Stella
    const msg1Res = await client.query('SELECT content FROM public.whatsapp_messages WHERE contato_id = $1 AND direction = \'outbound\' ORDER BY created_at DESC LIMIT 1;', [contato_id]);
    console.log('\n--- Resposta da Stella na Rodada 1 ---');
    console.log(msg1Res.rows[0]?.content || 'Nenhuma mensagem outbound enviada.');

    // --- RODADA 2: Cliente responde com seu nome "Rodrigo Mendes" ---
    // Esperamos que a Stella detecte o nome, retorne no JSON de dados_cliente e salve no banco.
    const msgId2 = 'wamid.TEST_NAME_MSG_2_' + Date.now();
    const payload2 = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '553398192119', phone_number_id: phone_number_id },
            contacts: [{ profile: { name: 'Cliente Desconhecido' }, wa_id: telefone_cliente }],
            messages: [{
              from: telefone_cliente,
              id: msgId2,
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: 'Olá, pode me chamar de Rodrigo Mendes' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('\nDisparando Chamada 2 (Cliente informa o nome)...');
    const r2 = await fetch('http://localhost:3000/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2)
    });
    console.log(`Resposta do webhook 2: Status ${r2.status}`);

    // Esperar para a Stella rodar no background
    console.log('Aguardando 12 segundos para processamento de background...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Verificar no banco o nome atual do contato
    const contactRes = await client.query('SELECT nome FROM public.contatos WHERE id = $1;', [contato_id]);
    console.log('\n--- Nome do Lead atualizado no CRM no Banco de Dados ---');
    console.log(`Nome atual no Banco: "${contactRes.rows[0]?.nome}"`);
    console.log('Esperado: "Rodrigo Mendes"\n');

    // Limpeza final do teste
    console.log('Limpando dados do teste...');
    await client.query('UPDATE public.whatsapp_conversations SET last_message_id = NULL WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.whatsapp_messages WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.telefones WHERE contato_id = $1;', [contato_id]);
    await client.query('DELETE FROM public.contatos WHERE id = $1;', [contato_id]);

  } catch (err) {
    console.error('Erro no script de teste:', err.message);
  }

  await client.end();
  console.log('Teste de coleta de nome concluído.');
}

main();

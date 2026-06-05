const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('1. Resetando dados cadastrais do contato Ranniere (5598)...');
  await client.query(`
    UPDATE contatos 
    SET 
      estado_civil = 'Casado(a)',
      rg = NULL,
      nacionalidade = NULL,
      birth_date = NULL,
      cargo = NULL,
      cep = NULL,
      address_street = NULL,
      address_number = NULL,
      address_complement = NULL,
      neighborhood = NULL,
      city = NULL,
      state = NULL
    WHERE id = 5598;
  `);

  console.log('2. Inserindo mensagem de teste de texto para o chat...');
  const msgId = 'wamid.TEST_STATE_CIVIL_' + Date.now();
  // Insere uma mensagem na conversa simulando a última fala do cliente
  await client.query(`
    INSERT INTO whatsapp_messages (
      message_id, 
      contato_id, 
      direction, 
      content, 
      status, 
      sent_at, 
      organizacao_id,
      sender_id
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7);
  `, [
    msgId,
    5598,
    'inbound',
    'Aqui está minha CNH, e sim, sou solteiro e meu cargo é Engenheiro de Software.',
    'read',
    2,
    '5533991912291'
  ]);

  // Atualizar a última mensagem na tabela whatsapp_conversations
  await client.query(`
    UPDATE whatsapp_conversations
    SET last_message_id = (SELECT id FROM whatsapp_messages WHERE message_id = $1)
    WHERE contato_id = 5598;
  `, [msgId]);

  console.log('3. Chamando API local /api/ai/chat-analysis para analisar e enriquecer...');
  try {
    const response = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contato_id: 5598, organizacao_id: 2, force: true })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('\n--- Resposta gerada pela Stella ---');
      console.log(`Resumo: ${data.resumo_interacao}`);
      console.log(`Temperatura: ${data.temperatura}`);
      console.log(`Próxima resposta: ${data.proxima_resposta_sugerida}`);
      console.log(`Dados Extraídos:`, JSON.stringify(data.dados_cliente, null, 2));
    } else {
      console.error('Erro na chamada da API:', await response.text());
    }
  } catch (error) {
    console.error('Erro ao conectar com a API local:', error.message);
  }

  console.log('\n4. Verificando dados aktualizados no banco de dados...');
  const res = await client.query(`
    SELECT id, nome, cpf, rg, nacionalidade, estado_civil, birth_date, cargo, cep, address_street, city, state
    FROM contatos 
    WHERE id = 5598;
  `);
  console.log(JSON.stringify(res.rows[0], null, 2));

  // Limpeza: remover a mensagem temporária criada
  console.log('\n5. Limpando mensagem de teste inserida...');
  await client.query('DELETE FROM whatsapp_messages WHERE message_id = $1;', [msgId]);
  
  // Restaura last_message_id para o valor correto
  const resLast = await client.query(`
    SELECT id FROM whatsapp_messages 
    WHERE contato_id = 5598 AND message_id != $1
    ORDER BY created_at DESC 
    LIMIT 1;
  `, [msgId]);
  if (resLast.rows.length > 0) {
    await client.query(`
      UPDATE whatsapp_conversations 
      SET last_message_id = $1 
      WHERE contato_id = 5598;
    `, [resLast.rows[0].id]);
  }

  await client.end();
  console.log('Teste concluído com sucesso!');
}

main();

const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('1. Inserindo mensagem fictícia "Quero o mais alto" na tabela whatsapp_messages para simular o lead...');
  
  const randomMsgId = 'wamid.TEST_' + Date.now();
  const phoneRanniere = '5533991912291';
  const phoneEmpresa = '690198827516149'; // ID de teste do telefone da empresa

  const insertRes = await client.query(`
    INSERT INTO whatsapp_messages (
      contato_id, 
      content, 
      direction, 
      status, 
      created_at, 
      sent_at,
      organizacao_id,
      message_id,
      sender_id,
      receiver_id
    ) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8)
    RETURNING id;
  `, [5598, 'Quero o mais alto', 'inbound', 'delivered', 2, randomMsgId, phoneRanniere, phoneEmpresa]);

  console.log(`Mensagem inserida com sucesso no banco, ID: ${insertRes.rows[0].id}`);

  console.log('2. Chamando a API de análise de chat da Stella localmente...');
  try {
    const response = await fetch('http://localhost:3000/api/ai/chat-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contato_id: 5598,
        organizacao_id: 2,
        force: true
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('\n==================================================');
    console.log('RETORNO DA ANÁLISE COM A RESPOSTA SUGERIDA DA STELLA:');
    console.log('==================================================');
    console.log(JSON.stringify(data, null, 2));
    console.log('==================================================\n');

  } catch (err) {
    console.error('Falha ao rodar a análise de chat:', err.message);
  }

  console.log('3. Limpando a mensagem fictícia do banco de dados...');
  await client.query('DELETE FROM whatsapp_messages WHERE id = $1', [insertRes.rows[0].id]);
  console.log('Limpeza concluída.');

  await client.end();
}

main();

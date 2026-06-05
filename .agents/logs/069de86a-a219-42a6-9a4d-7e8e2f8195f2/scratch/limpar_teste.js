const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Limpando a última mensagem de teste associada à conversa do Ranniere...');
  try {
    // Busca a penúltima mensagem real do contato 5598 na tabela whatsapp_messages para restaurar a conversa
    const resMsg = await client.query(`
      SELECT id 
      FROM whatsapp_messages 
      WHERE contato_id = 5598 AND id != 21203
      ORDER BY created_at DESC 
      LIMIT 1;
    `);

    if (resMsg.rows.length > 0) {
      const realLastMsgId = resMsg.rows[0].id;
      console.log(`Penúltima mensagem real encontrada (ID: ${realLastMsgId}). Atualizando conversa...`);
      
      await client.query(`
        UPDATE whatsapp_conversations 
        SET last_message_id = $1 
        WHERE contato_id = 5598;
      `, [realLastMsgId]);
    } else {
      await client.query(`
        UPDATE whatsapp_conversations 
        SET last_message_id = NULL 
        WHERE contato_id = 5598;
      `);
    }

    console.log('Apagando a mensagem temporária de teste...');
    await client.query('DELETE FROM whatsapp_messages WHERE id = 21203;');
    console.log('Mensagem apagada com sucesso!');

  } catch (err) {
    console.error('Erro na limpeza:', err.message);
  }

  await client.end();
}

main();

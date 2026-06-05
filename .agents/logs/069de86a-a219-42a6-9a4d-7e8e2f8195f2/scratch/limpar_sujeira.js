const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Restaurando last_message_id do Ranniere...');
  // Restaura last_message_id para a última mensagem legítima
  const resLast = await client.query(`
    SELECT id FROM whatsapp_messages 
    WHERE contato_id = 5598 AND message_id NOT LIKE 'wamid.TEST_STATE_CIVIL_%'
    ORDER BY created_at DESC 
    LIMIT 1;
  `);

  if (resLast.rows.length > 0) {
    const realId = resLast.rows[0].id;
    console.log(`Último ID real encontrado: ${realId}. Atualizando conversa...`);
    await client.query(`
      UPDATE whatsapp_conversations 
      SET last_message_id = $1 
      WHERE contato_id = 5598;
    `, [realId]);
  } else {
    await client.query(`
      UPDATE whatsapp_conversations 
      SET last_message_id = NULL 
      WHERE contato_id = 5598;
    `);
  }

  console.log('Apagando mensagens de teste...');
  const delRes = await client.query(`
    DELETE FROM whatsapp_messages 
    WHERE message_id LIKE 'wamid.TEST_STATE_CIVIL_%';
  `);
  console.log(`Apagadas ${delRes.rowCount} mensagens.`);

  await client.end();
  console.log('Limpeza concluída!');
}

main();

const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  const contato_id = 5598;
  console.log('--- BUSCANDO MENSAGENS DO RANNIERE (5598) ---');
  const resMsg = await client.query(`
    SELECT id, message_id, content, direction, status, sent_at, created_at, error_message
    FROM public.whatsapp_messages
    WHERE contato_id = $1
    ORDER BY created_at DESC
    LIMIT 10;
  `, [contato_id]);

  for (const msg of resMsg.rows) {
    console.log(`\nID: ${msg.id} | MsgID: ${msg.message_id} | Dir: ${msg.direction} | Data: ${msg.created_at}`);
    console.log(`Content: "${msg.content}"`);
    console.log(`Status: ${msg.status} | Error: ${msg.error_message}`);
  }

  console.log('\n--- BUSCANDO LOGS DO WEBHOOK RECENTES ---');
  const resLogs = await client.query(`
    SELECT *
    FROM public.whatsapp_webhook_logs
    ORDER BY created_at DESC
    LIMIT 15;
  `);

  for (const log of resLogs.rows) {
    console.log(log);
  }

  await client.end();
}

main();

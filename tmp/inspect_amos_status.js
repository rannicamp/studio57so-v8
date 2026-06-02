const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== DETALHES DE STATUS DAS MENSAGENS DO AMOS ===');
  
  const msgRes = await client.query(`
    SELECT id, message_id, content, direction, status, sent_at
    FROM whatsapp_messages
    WHERE contato_id = 5685
    ORDER BY sent_at ASC;
  `);

  msgRes.rows.forEach(r => {
    console.log({
      id: r.id,
      message_id: r.message_id,
      status: r.status,
      sent_at: r.sent_at,
      content: r.content ? r.content.substring(0, 50) + '...' : 'NULL'
    });
  });

  await client.end();
}

main().catch(console.error);

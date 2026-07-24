const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('=== BUSCANDO CONTATO MICHELLE RAMOS ===');
  
  const contatosRes = await client.query(`
    SELECT id, nome, organizacao_id, created_at
    FROM contatos 
    WHERE nome ILIKE '%Michelle Ramos%'
  `);
  
  console.log('Contatos encontrados:', contatosRes.rows);

  if (contatosRes.rows.length > 0) {
    const contatoIds = contatosRes.rows.map(c => c.id);
    
    // Buscar mensagens
    const msgRes = await client.query(`
      SELECT id, contato_id, direction, content, status, sent_at, error_message, receiver_id, message_id
      FROM whatsapp_messages
      WHERE contato_id = ANY($1)
      ORDER BY sent_at ASC;
    `, [contatoIds]);

    console.log('\nMensagens da Michelle Ramos:');
    msgRes.rows.forEach(m => {
      console.log({
        id: m.id,
        contato_id: m.contato_id,
        direction: m.direction,
        status: m.status,
        sent_at: m.sent_at,
        error_message: m.error_message,
        message_id: m.message_id,
        content: m.content
      });
    });
  }

  await client.end();
}

main().catch(console.error);

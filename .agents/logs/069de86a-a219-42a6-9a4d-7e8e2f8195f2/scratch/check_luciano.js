const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- DETALHES DAS MENSAGENS DE LUCIANO ---');

  // Buscar detalhes de todas as mensagens associadas ao telefone ou contato
  const res = await client.query(`
    SELECT 
      id, 
      contato_id, 
      conversation_record_id, 
      direction, 
      content, 
      sent_at, 
      created_at, 
      sender_id, 
      receiver_id,
      organizacao_id
    FROM whatsapp_messages 
    WHERE contato_id IN (5629, 5630) 
       OR receiver_id LIKE '%17819704126%' 
       OR sender_id LIKE '%17819704126%'
    ORDER BY sent_at ASC;
  `);

  res.rows.forEach(r => {
    console.log({
      id: r.id,
      contato_id: r.contato_id,
      conversation_record_id: r.conversation_record_id,
      direction: r.direction,
      sent_at: r.sent_at,
      sender_id: r.sender_id,
      receiver_id: r.receiver_id,
      content: r.content ? r.content.substring(0, 50) + '...' : 'NULL'
    });
  });

  // Também verificar os contatos 5629 e 5630 na tabela contatos
  const resContatos = await client.query(`
    SELECT id, nome, created_at, organizacao_id
    FROM contatos 
    WHERE id IN (5629, 5630);
  `);
  console.log('\nContatos cadastrados:', resContatos.rows);

  await client.end();
}

main();

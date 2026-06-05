const { Client } = require('c:/Projetos/studio57so-v8/node_modules/pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('Buscando contatos com nome Igor...');
  const res = await client.query(`
    SELECT id, nome, created_at, ai_analysis, ia_atendimento_ativo
    FROM public.contatos
    WHERE nome ILIKE '%Igor%'
    ORDER BY created_at DESC;
  `);

  console.log('Contatos encontrados:', res.rows);

  if (res.rows.length > 0) {
    const contatoId = 659; // Ajustado para o ID correto com ia_atendimento_ativo: true
    console.log(`\nBuscando mensagens do contato ID ${contatoId} (Igor)...`);
    const resMsg = await client.query(`
      SELECT id, message_id, content, direction, status, sent_at, created_at, error_message, raw_payload
      FROM public.whatsapp_messages
      WHERE contato_id = $1
      ORDER BY created_at DESC
      LIMIT 15;
    `, [contatoId]);

    for (const msg of resMsg.rows) {
      console.log(`\nID: ${msg.id} | MsgID: ${msg.message_id} | Dir: ${msg.direction} | Data: ${msg.created_at}`);
      console.log(`Content: "${msg.content}"`);
      console.log(`Status: ${msg.status} | Error: ${msg.error_message}`);
    }
  }

  await client.end();
}

main();

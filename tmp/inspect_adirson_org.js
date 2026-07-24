const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, 
    ssl: { rejectUnauthorized: false } 
  });
  await client.connect();

  console.log('--- CHECAGEM DE ORGANIZACAO_ID DE ADIRSON ---');

  const resMsg = await client.query(`
    SELECT id, contato_id, organizacao_id, content
    FROM whatsapp_messages
    WHERE contato_id = 5199
    LIMIT 5;
  `);

  console.log('Mensagens do contato 5199:');
  resMsg.rows.forEach(r => {
    console.log(` - ID: ${r.id} | Org: ${r.organizacao_id} | Content: "${r.content ? r.content.substring(0, 40) + '...' : ''}"`);
  });

  const resCont = await client.query(`
    SELECT id, nome, organizacao_id
    FROM contatos
    WHERE id = 5199;
  `);
  console.log('\nContato 5199:');
  console.log(resCont.rows[0]);

  await client.end();
}

main();

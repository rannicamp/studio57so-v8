const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const contatoId = 3481;
  const telefones = await client.query('SELECT * FROM telefones WHERE contato_id = $1', [contatoId]);
  console.log('Telefones:', telefones.rows);
  
  const conv = await client.query('SELECT * FROM whatsapp_conversations WHERE contato_id = $1', [contatoId]);
  console.log('Conversas:', conv.rows);
  
  const msgs = await client.query('SELECT * FROM whatsapp_messages WHERE contato_id = $1 ORDER BY id DESC LIMIT 2', [contatoId]);
  console.log('Mensagens:', msgs.rows.map(m => ({ id: m.id, status: m.status, error: m.error_message })));

  await client.end();
}
main();

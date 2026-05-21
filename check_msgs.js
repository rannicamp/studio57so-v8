const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const msgs = await client.query("SELECT direction, content FROM whatsapp_messages WHERE conversation_record_id = 15580 ORDER BY id ASC");
  console.log(msgs.rows.map(m => `[${m.direction}] ${m.content}`));

  await client.end();
}
main();

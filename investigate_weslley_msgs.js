const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const msgs = await client.query("SELECT id, created_at, status, error_message, direction FROM whatsapp_messages WHERE conversation_record_id = 16705 ORDER BY created_at DESC LIMIT 10");
  for (const m of msgs.rows) {
      console.log(`Msg ID: ${m.id} | Dir: ${m.direction} | Data: ${m.created_at} | Status: ${m.status} | Err: ${m.error_message}`);
  }
  await client.end();
}
main();

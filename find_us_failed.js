const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const failedUS = await client.query("SELECT * FROM whatsapp_messages WHERE status = 'failed' AND (receiver_id LIKE '1%' OR receiver_id LIKE '+1%')");
  console.log('Failed US:', failedUS.rows.map(r => ({ receiver: r.receiver_id, err: r.error_message })));

  const failed551 = await client.query("SELECT * FROM whatsapp_messages WHERE status = 'failed' AND receiver_id LIKE '551%'");
  for (const r of failed551.rows) {
    // only show those that look like US numbers incorrectly prepended with 55
    if (r.receiver_id.length > 11) {
       console.log('Failed 551:', r.receiver_id, r.error_message);
    }
  }

  await client.end();
}
main();

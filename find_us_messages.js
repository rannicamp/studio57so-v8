const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const failedUS = await client.query("SELECT * FROM whatsapp_messages WHERE status = 'failed' AND receiver_id LIKE '1%'");
  console.log('Failed messages to US numbers (starting with 1):', failedUS.rows.length);
  for (const m of failedUS.rows) {
    console.log(`Msg ID: ${m.id}, Receiver: ${m.receiver_id}, Error: ${m.error_message}, Contact ID: ${m.contato_id}`);
  }

  // Just in case, let's also check telefones table for US numbers
  const telefones = await client.query("SELECT * FROM telefones WHERE telefone LIKE '1%' OR country_code = '+1'");
  console.log('Telefones starting with 1 or +1:', telefones.rows.length);
  for (const t of telefones.rows) {
    console.log(`Contact ID: ${t.contato_id}, Phone: ${t.telefone}`);
  }

  await client.end();
}
main();

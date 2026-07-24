const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT * FROM sys_notification_templates WHERE tabela_alvo = 'whatsapp_messages';
  `);
  console.log("Templates:");
  console.log(JSON.stringify(res.rows, null, 2));

  const res2 = await client.query(`
    SELECT * FROM regras_notificacao WHERE tabela_alvo = 'whatsapp_messages';
  `);
  console.log("Regras (Antigo):");
  console.log(JSON.stringify(res2.rows, null, 2));
  await client.end();
}
run();

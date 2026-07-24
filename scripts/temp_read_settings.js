const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT * FROM sys_org_notification_settings WHERE template_id = 28;
  `);
  console.log("Settings for template 28:");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();

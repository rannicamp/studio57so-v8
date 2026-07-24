const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_radar_stats'");
  console.log(res.rows[0]?.prosrc);
  await client.end();
}
main();

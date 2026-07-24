const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT proname FROM pg_proc WHERE proname ILIKE '%tempo%' OR proname ILIKE '%resposta%' OR proname ILIKE '%kpi%' OR proname ILIKE '%relatorio%' OR proname ILIKE '%time%'");
  console.log('Funções encontradas:');
  for (const row of res.rows) {
      if (!row.proname.startsWith('pg_') && !row.proname.startsWith('array_') && !row.proname.startsWith('date_') && !row.proname.startsWith('time')) {
          console.log(row.proname);
      }
  }
  await client.end();
}
main();

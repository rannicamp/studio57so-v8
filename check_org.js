const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres`, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    SELECT id, email, organizacao_id FROM usuarios LIMIT 5;
  `;

  try {
      const res = await client.query(query);
      console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();

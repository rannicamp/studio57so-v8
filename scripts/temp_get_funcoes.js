const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT * FROM funcoes;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();

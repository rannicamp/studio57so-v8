const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    SELECT prosrc, pg_get_function_arguments(oid) as args
    FROM pg_proc 
    WHERE proname = 'get_conversation_response_kpis';
  `;

  try {
      const res = await client.query(query);
      console.log(JSON.stringify(res.rows[0], null, 2));
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();

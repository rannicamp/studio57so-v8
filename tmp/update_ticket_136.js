const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  try {
    await client.query(`
      UPDATE public.feedback 
      SET status = 'Implementado'
      WHERE id = 136;
    `);
    console.log("Ticket 136 updated.");

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();

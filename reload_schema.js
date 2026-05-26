const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
  await client.connect();

  const query = `
    NOTIFY pgrst, 'reload schema';
  `;

  try {
      await client.query(query);
      console.log('Schema cache reloaded!');
  } catch(e) {
      console.error('Erro:', e);
  }

  await client.end();
}

main();

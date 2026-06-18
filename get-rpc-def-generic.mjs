import pg from 'pg';

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query(`
      SELECT pg_get_functiondef(oid) as definition 
      FROM pg_proc 
      WHERE proname = 'get_bim_field_values';
    `);
    
    if (res.rows.length > 0) {
      console.log('--- RPC DEFINITION ---');
      console.log(res.rows[0].definition);
    } else {
      console.log('Função get_bim_field_values não encontrada.');
    }
  } catch (err) {
    console.error('Erro:', err);
  }
  await client.end();
}
run();

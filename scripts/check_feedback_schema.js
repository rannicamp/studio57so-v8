const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'feedback';
  `);
  console.log('Feedback columns:');
  console.log(cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  
  const tickets = await client.query(`
    SELECT *
    FROM feedback
    WHERE status IN ('Novo', 'Em Análise')
      AND diagnostico IS NULL
  `);
  console.log('Pendentes count:', tickets.rows.length);
  if (tickets.rows.length > 0) {
    console.log('Tickets:', JSON.stringify(tickets.rows, null, 2));
  }

  await client.end();
}

run().catch(console.error);

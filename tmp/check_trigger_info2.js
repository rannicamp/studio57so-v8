const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Extrair password
const supabaseUrlMatch = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.*?)\./);
const projectId = supabaseUrlMatch[1];
const password = process.env.SUPABASE_DB_PASSWORD; // Adicionada anteriormente

if (!password) {
    console.error('SUPABASE_DB_PASSWORD is not set in .env.local');
    process.exit(1);
}

const connectionString = `postgresql://postgres.${projectId}:${password}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;

async function check() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
      SELECT trigger_name, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'contatos_no_funil';
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

check().catch(console.error);

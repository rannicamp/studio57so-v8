import pg from 'pg';
import fs from 'fs';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'materiais';
  `);
  fs.writeFileSync('materiais_schema.json', JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();

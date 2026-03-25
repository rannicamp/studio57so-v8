const { Client } = require('pg'); 
const c = new Client({ connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } }); 
async function run() { 
  await c.connect(); 
  const { rows } = await c.query("SELECT policyname, qual FROM pg_policies WHERE tablename = 'usuarios'"); 
  console.log(rows); 
  c.end(); 
} 
run();

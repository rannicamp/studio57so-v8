require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
async function run() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if(!dbUrl) return console.log('not found ds');
  const sql = postgres(dbUrl, { ssl: 'require' });
  const res = await sql`
    SELECT event_object_table AS table_name,
           trigger_name, 
           event_manipulation AS event, 
           action_statement AS definition
    FROM information_schema.triggers
    WHERE event_object_table = 'lancamentos';
  `;
  console.log(res);
  await sql.end();
}
run();

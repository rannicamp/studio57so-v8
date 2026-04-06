require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
async function r() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query('SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table IN (\'funcionarios\', \'historico_salarial\');');
  console.table(res.rows);
  await c.end();
}
r();

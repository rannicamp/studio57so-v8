require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function getRPC() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const baseHost = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('/')[0];
  const projectId = baseHost.split('.')[0];
  const host = `db.${projectId}.supabase.co`;
  const connStr = `postgres://postgres:${password}@${host}:6543/postgres`;

  const client = new Client({ connectionString: connStr });
  await client.connect();
  
  const query = `
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_type = 'FUNCTION' 
      AND specific_schema = 'public'
      AND routine_name IN ('provisionar_parcelas_contrato', 'sincronizar_parcela_com_lancamento');
  `;
  
  try {
    const res = await client.query(query);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Erro:", err.message);
  }

  await client.end();
}
getRPC();

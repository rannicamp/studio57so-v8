const { Client } = require('pg');

async function run() {
  const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('🔌 Conectado');

    const res = await client.query(`
      SELECT id, tabela_gatilho, nome_variavel, coluna_origem, tabela_destino, coluna_chave_destino, coluna_retorno
      FROM public.variaveis_virtuais;
    `);
    console.table(res.rows);

  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}

run();

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('Adicionando coluna JSONB...');
    await pool.query(`ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS execucao_fisica JSONB DEFAULT '{}'::jsonb;`);
    console.log('Sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    pool.end();
  }
}
run();

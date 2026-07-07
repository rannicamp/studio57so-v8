const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260707_indices_notifications.sql');
    console.log(`📖 Lendo arquivo de migração: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.connect();
    console.log('✅ Conectado ao Supabase');

    console.log('⚙️ Executando migração no banco de dados...');
    await client.query(sql);
    console.log('🎉 Migração concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada.');
  }
}

run();

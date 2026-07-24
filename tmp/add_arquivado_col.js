const { Client } = require('pg');

const STUDIO_URL = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD ? encodeURIComponent(process.env.SUPABASE_DB_PASSWORD) : 'REMOVED_PASSWORD'}@db.vhuvnutzklhskkwbpxdz.supabase.co:6543/postgres`;
const SSL = { rejectUnauthorized: false };

async function runSQL() {
  const client = new Client({
      connectionString: decodeURIComponent(STUDIO_URL),
      ssl: SSL
  });
  
  try {
     console.log('Estabelecendo link P2P com Supabase...');
     await client.connect();
     
     console.log('Adicionando coluna arquivado...');
     await client.query('ALTER TABLE empreendimentos ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT false;');
     console.log('Operação SQL homologada com sucesso!');
  } catch(e) {
     console.error('FALHA NA INJEÇÃO SQL:', e.message);
  } finally {
     await client.end();
  }
}

runSQL();

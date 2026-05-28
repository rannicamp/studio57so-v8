const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    console.log('Lendo SQL de scratch/cleanup_and_deploy.sql...');
    const sql = fs.readFileSync('scratch/cleanup_and_deploy.sql', 'utf8');
    
    console.log('Conectando ao banco Supabase...');
    await client.connect();
    
    console.log('Executando limpeza e recriação no banco...');
    await client.query(sql);
    console.log('✅ RPC fn_relatorio_comercial limpa e recriada com sucesso! Sem sobrecargas!');
    
  } catch (err) {
    console.error('❌ Erro ao rodar deploy no banco:', err);
  } finally {
    await client.end();
  }
}

main();

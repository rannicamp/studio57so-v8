const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    console.log('Lendo SQL atualizado de scratch/updated_fn_relatorio_comercial.sql...');
    const sql = fs.readFileSync('scratch/updated_fn_relatorio_comercial.sql', 'utf8');
    
    console.log('Conectando ao banco Supabase...');
    await client.connect();
    
    console.log('Executando comando no banco de dados...');
    await client.query(sql);
    console.log('✅ RPC fn_relatorio_comercial atualizada com sucesso no banco de dados!');
    
  } catch (err) {
    console.error('❌ Erro ao atualizar RPC no banco:', err);
  } finally {
    await client.end();
  }
}

main();

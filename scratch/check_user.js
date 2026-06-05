const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Lista os usuários e suas organizações
    const res = await client.query(`
      SELECT id, nome, email, organizacao_id 
      FROM usuarios 
      WHERE email ILIKE '%ranni%' OR nome ILIKE '%ranni%';
    `);
    console.log("=== Usuário Ranniere no Banco ===");
    console.table(res.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();

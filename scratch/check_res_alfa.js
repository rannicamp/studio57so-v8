const { Client } = require('pg');

async function main() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres:Srbr19010720%40@db.vhuvnutzklhskkwbpxdz.supabase.co:5432/postgres', 
    ssl: { rejectUnauthorized: false } 
  });
  
  try {
    await client.connect();
    
    // Busca empreendimentos com nome Residencial Alfa
    const res = await client.query(`
      SELECT id, nome, organizacao_id 
      FROM empreendimentos 
      WHERE nome ILIKE '%alfa%';
    `);
    console.log("=== Empreendimentos com Alfa ===");
    console.table(res.rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.end();
  }
}

main();
